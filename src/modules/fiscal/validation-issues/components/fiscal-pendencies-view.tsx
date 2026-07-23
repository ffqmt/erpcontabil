'use client'

import React, { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiscalPendency, PendencyCounters, PendencyIssueType, PendencySeverity, PendencyStatus } from '../types'
import { PENDENCY_ISSUE_TYPE_LABELS, PENDENCY_SEVERITY_LABELS, PENDENCY_STATUS_LABELS, SUGGESTED_ACTION_LABELS } from '../labels'
import { ignoreValidationIssueAction, resolveValidationIssueAction } from '../actions'
import { FISCAL_DOCUMENT_TYPE_LABELS } from '../../utils'
import { AlertOctagon, AlertTriangle, Info, FileStack, Loader2, CheckCircle2, EyeOff, Search } from 'lucide-react'

interface Partner {
  id: string
  name: string
}

interface FiscalPendenciesViewProps {
  pendencies: FiscalPendency[]
  partners: Partner[]
  counters: PendencyCounters
}

const SEVERITY_BADGE: Record<PendencySeverity, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
  WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
  INFO: 'bg-blue-50 text-blue-700 border-blue-200'
}

const STATUS_BADGE: Record<PendencyStatus, string> = {
  OPEN: 'bg-gray-100 text-gray-700 border-gray-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  IGNORED: 'bg-gray-50 text-gray-400 border-gray-200'
}

const inputClass = 'px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'

export function FiscalPendenciesView({ pendencies, partners, counters }: FiscalPendenciesViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [actingId, setActingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [competence, setCompetence] = useState(searchParams.get('competence') || '')
  const [documentType, setDocumentType] = useState(searchParams.get('documentType') || '')
  const [direction, setDirection] = useState(searchParams.get('direction') || '')
  const [partnerId, setPartnerId] = useState(searchParams.get('partnerId') || '')

  const [severity, setSeverity] = useState<PendencySeverity | ''>('')
  const [status, setStatus] = useState<PendencyStatus | ''>('OPEN')
  const [issueType, setIssueType] = useState<PendencyIssueType | ''>('')
  const [origin, setOrigin] = useState<'' | 'XML' | 'MANUAL'>('')

  function applyServerFilters(e?: React.FormEvent) {
    e?.preventDefault()
    const params = new URLSearchParams()
    if (competence) params.set('competence', competence)
    if (documentType) params.set('documentType', documentType)
    if (direction) params.set('direction', direction)
    if (partnerId) params.set('partnerId', partnerId)
    router.push(`/fiscal/pendencias?${params.toString()}`)
  }

  const filtered = useMemo(() => {
    return pendencies.filter((p) => {
      if (severity && p.severity !== severity) return false
      if (status && p.status !== status) return false
      if (issueType && p.issueType !== issueType) return false
      if (origin === 'XML' && p.documentSource !== 'XML') return false
      if (origin === 'MANUAL' && p.documentSource === 'XML') return false
      return true
    })
  }, [pendencies, severity, status, issueType, origin])

  function runAction(p: FiscalPendency, kind: 'IGNORE' | 'RESOLVE') {
    setActionError(null)
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
      if (res.ok) {
        router.refresh()
      } else {
        setActionError(res.error)
      }
    })
  }

  function suggestedActionHref(p: FiscalPendency): string {
    if (p.suggestedAction === 'REVIEW_ITEM') return '/fiscal/revisao-itens'
    if (p.suggestedAction === 'GO_ASSESSMENT') return '/fiscal/apuracoes'
    return `/fiscal/documentos/${p.fiscalDocumentId}`
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-red-100 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50 text-red-600"><AlertOctagon className="w-5 h-5" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-800 tabular-nums">{counters.critical}</p>
            <p className="text-xs text-gray-500">Críticas</p>
          </div>
        </div>
        <div className="bg-white border border-amber-100 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><AlertTriangle className="w-5 h-5" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-800 tabular-nums">{counters.warning}</p>
            <p className="text-xs text-gray-500">Avisos</p>
          </div>
        </div>
        <div className="bg-white border border-blue-100 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Info className="w-5 h-5" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-800 tabular-nums">{counters.info}</p>
            <p className="text-xs text-gray-500">Informativas</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100 text-gray-600"><FileStack className="w-5 h-5" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-800 tabular-nums">{counters.affectedDocuments}</p>
            <p className="text-xs text-gray-500">Documentos afetados</p>
          </div>
        </div>
      </div>

      <form onSubmit={applyServerFilters} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Competência</label>
          <input type="month" className={inputClass} value={competence} onChange={(e) => setCompetence(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Tipo de documento</label>
          <select className={inputClass} value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(FISCAL_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Direção</label>
          <select className={inputClass} value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="">Todas</option>
            <option value="IN">Entrada</option>
            <option value="OUT">Saída</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Parceiro</label>
          <select className={inputClass} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">Todos</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer">
          <Search className="w-3.5 h-3.5" />
          Filtrar
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Severidade</label>
          <select className={inputClass} value={severity} onChange={(e) => setSeverity(e.target.value as PendencySeverity | '')}>
            <option value="">Todas</option>
            {Object.entries(PENDENCY_SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Status</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as PendencyStatus | '')}>
            <option value="">Todos</option>
            {Object.entries(PENDENCY_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Tipo de pendência</label>
          <select className={inputClass} value={issueType} onChange={(e) => setIssueType(e.target.value as PendencyIssueType | '')}>
            <option value="">Todos</option>
            {Object.entries(PENDENCY_ISSUE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Origem</label>
          <select className={inputClass} value={origin} onChange={(e) => setOrigin(e.target.value as '' | 'XML' | 'MANUAL')}>
            <option value="">Todas</option>
            <option value="XML">XML</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} pendência(s) no filtro atual</span>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-xs font-semibold">{actionError}</div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-300" />
          <span className="text-sm font-semibold text-gray-600">Nenhuma pendência encontrada para este filtro</span>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-400 uppercase text-[10px] border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left py-2.5 px-3">Documento</th>
                <th className="text-left py-2.5 px-3">Parceiro</th>
                <th className="text-left py-2.5 px-3">Emissão</th>
                <th className="text-left py-2.5 px-3">Tipo</th>
                <th className="text-left py-2.5 px-3">Direção</th>
                <th className="text-left py-2.5 px-3">Pendência</th>
                <th className="text-left py-2.5 px-3">Severidade</th>
                <th className="text-left py-2.5 px-3">Ação sugerida</th>
                <th className="text-left py-2.5 px-3">Status</th>
                <th className="text-left py-2.5 px-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="py-2.5 px-3">
                    <Link href={`/fiscal/documentos/${p.fiscalDocumentId}`} className="font-semibold text-emerald-700 hover:underline">
                      {p.documentNumber || p.fiscalDocumentId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="py-2.5 px-3 text-gray-600">{p.partnerName || '—'}</td>
                  <td className="py-2.5 px-3 text-gray-500">{p.issueDate || '—'}</td>
                  <td className="py-2.5 px-3 text-gray-500">{FISCAL_DOCUMENT_TYPE_LABELS[p.documentType as keyof typeof FISCAL_DOCUMENT_TYPE_LABELS] || p.documentType}</td>
                  <td className="py-2.5 px-3 text-gray-500">{p.direction === 'IN' ? 'Entrada' : 'Saída'}</td>
                  <td className="py-2.5 px-3 text-gray-700 max-w-xs">
                    <p className="font-semibold text-gray-800">{PENDENCY_ISSUE_TYPE_LABELS[p.issueType]}</p>
                    <p className="text-gray-500">{p.message}</p>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${SEVERITY_BADGE[p.severity]}`}>
                      {PENDENCY_SEVERITY_LABELS[p.severity]}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <Link href={suggestedActionHref(p)} className="text-indigo-600 hover:underline font-semibold">
                      {SUGGESTED_ACTION_LABELS[p.suggestedAction]}
                    </Link>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${STATUS_BADGE[p.status]}`}>
                      {PENDENCY_STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {p.origin === 'VALIDATION' && p.status === 'OPEN' ? (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={isPending && actingId === p.id}
                          onClick={() => runAction(p, 'RESOLVE')}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded font-semibold disabled:opacity-50 cursor-pointer"
                        >
                          {isPending && actingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Resolvida
                        </button>
                        <button
                          type="button"
                          disabled={isPending && actingId === p.id}
                          onClick={() => runAction(p, 'IGNORE')}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded font-semibold disabled:opacity-50 cursor-pointer"
                        >
                          <EyeOff className="w-3 h-3" />
                          Ignorar
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
