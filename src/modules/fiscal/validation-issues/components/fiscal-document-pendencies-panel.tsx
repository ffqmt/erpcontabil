'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiscalPendency } from '../types'
import { PENDENCY_ISSUE_TYPE_LABELS, PENDENCY_SEVERITY_LABELS, SUGGESTED_ACTION_LABELS } from '../labels'
import { ignoreValidationIssueAction, resolveValidationIssueAction } from '../actions'
import { AlertOctagon, AlertTriangle, Info, CheckCircle2, Loader2, EyeOff } from 'lucide-react'

interface FiscalDocumentPendenciesPanelProps {
  pendencies: FiscalPendency[]
}

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  CRITICAL: <AlertOctagon className="w-4 h-4 text-red-600" />,
  WARNING: <AlertTriangle className="w-4 h-4 text-amber-600" />,
  INFO: <Info className="w-4 h-4 text-blue-600" />
}

const SEVERITY_BORDER: Record<string, string> = {
  CRITICAL: 'border-red-200',
  WARNING: 'border-amber-200',
  INFO: 'border-blue-200'
}

export function FiscalDocumentPendenciesPanel({ pendencies }: FiscalDocumentPendenciesPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open = pendencies.filter((p) => p.status === 'OPEN')

  function runAction(p: FiscalPendency, kind: 'IGNORE' | 'RESOLVE') {
    setError(null)
    setActingId(p.id)
    startTransition(async () => {
      const payload = {
        fiscalDocumentId: p.fiscalDocumentId,
        fiscalDocumentItemId: p.fiscalDocumentItemId,
        issueType: p.issueType,
        severity: p.severity,
        message: p.message
      }
      const res = kind === 'IGNORE' ? await ignoreValidationIssueAction(payload) : await resolveValidationIssueAction(payload)
      setActingId(null)
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Pendências de Escrituração
        </h3>
        <Link href="/fiscal/pendencias" className="text-[11px] font-semibold text-indigo-600 hover:underline">
          Ver central de pendências
        </Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-2.5 text-xs font-semibold">{error}</div>}

      {open.length === 0 ? (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Nenhuma pendência aberta para este documento.
        </p>
      ) : (
        <div className="space-y-2">
          {open.map((p) => (
            <div key={p.id} className={`border rounded-lg p-3 text-xs flex items-start justify-between gap-3 ${SEVERITY_BORDER[p.severity]}`}>
              <div className="flex items-start gap-2 min-w-0">
                {SEVERITY_ICON[p.severity]}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">{PENDENCY_ISSUE_TYPE_LABELS[p.issueType]} <span className="text-gray-400 font-normal">· {PENDENCY_SEVERITY_LABELS[p.severity]}</span></p>
                  <p className="text-gray-500">{p.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={p.suggestedAction === 'REVIEW_ITEM' ? '/fiscal/revisao-itens' : p.suggestedAction === 'GO_ASSESSMENT' ? '/fiscal/apuracoes' : `#`}
                  className="text-indigo-600 hover:underline font-semibold whitespace-nowrap"
                >
                  {SUGGESTED_ACTION_LABELS[p.suggestedAction]}
                </Link>
                {p.origin === 'VALIDATION' && (
                  <>
                    <button
                      type="button"
                      disabled={isPending && actingId === p.id}
                      onClick={() => runAction(p, 'RESOLVE')}
                      className="inline-flex items-center gap-1 px-2 py-1 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {isPending && actingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Resolvida
                    </button>
                    <button
                      type="button"
                      disabled={isPending && actingId === p.id}
                      onClick={() => runAction(p, 'IGNORE')}
                      className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <EyeOff className="w-3 h-3" />
                      Ignorar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
