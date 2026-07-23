'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TaxAssessment } from '../types'
import { TaxAssessmentStatusBadge } from './tax-assessment-status-badge'
import { formatCurrencyBRL, formatCompetenceBR } from '../utils'
import { recalculateTaxAssessmentCompetenceAction, BatchAssessmentResultItem } from '../actions'
import { FileStack, ChevronRight, RefreshCw, Filter, CheckCircle2, AlertCircle } from 'lucide-react'

interface TaxAssessmentListProps {
  assessments: TaxAssessment[]
  defaultCompetence?: string
}

function competenceToMonth(comp?: string) {
  return comp ? comp.substring(0, 7) : ''
}

export function TaxAssessmentList({ assessments, defaultCompetence }: TaxAssessmentListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedMonth, setSelectedMonth] = useState<string>(competenceToMonth(defaultCompetence))
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [results, setResults] = useState<BatchAssessmentResultItem[] | null>(null)

  const filteredAssessments = selectedMonth
    ? assessments.filter((a) => a.competence.startsWith(selectedMonth))
    : assessments

  function handleRecalculate() {
    if (!selectedMonth) {
      setErrorMsg('Selecione a competência para recalcular.')
      return
    }
    setErrorMsg(null)
    setSuccessMsg(null)
    setResults(null)

    startTransition(async () => {
      const res = await recalculateTaxAssessmentCompetenceAction({ competence: `${selectedMonth}-01` })
      if (res.ok) {
        setResults(res.data.items)
        setSuccessMsg(res.message || `Competência ${selectedMonth} recalculada com sucesso.`)
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtro e Ação de Recálculo */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Competência:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {selectedMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth('')}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRecalculate}
          disabled={isPending || !selectedMonth}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Recalculando...' : 'Recalcular Competência'}
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-xs font-semibold flex gap-2.5 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3.5 rounded-xl text-xs font-semibold flex gap-2.5 items-start">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Painel de Resumo do Recálculo */}
      {results && results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-600 border-b pb-2">
            Resultado do Recálculo — Competência {selectedMonth}
          </h4>
          <div className="space-y-1.5">
            {results.map((r) => (
              <div
                key={r.taxType}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-800">{r.taxType}</span>
                  <span className="text-gray-500">• {r.message}</span>
                </div>
                {typeof r.payableAmount === 'number' && (
                  <span className="font-mono font-bold text-emerald-700">
                    R$ {r.payableAmount.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Apurações */}
      {filteredAssessments.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
          <FileStack className="w-8 h-8 text-gray-300" />
          <span className="text-sm font-semibold text-gray-600">
            Nenhuma apuração fiscal encontrada {selectedMonth ? `para a competência ${selectedMonth}` : ''}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssessments.map((a) => (
            <Link
              key={a.id}
              href={`/fiscal/apuracoes/${a.id}`}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4 hover:shadow-sm hover:border-emerald-300 transition-all"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-800 text-sm">{a.tax_type}</span>
                  <span className="text-xs text-gray-400">{formatCompetenceBR(a.competence)}</span>
                  <TaxAssessmentStatusBadge status={a.status} />
                </div>
                <p className="text-[11px] text-gray-400">
                  {a.journal_entry?.number ? `Lançamento nº ${a.journal_entry.number}` : 'Ainda não contabilizada'}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-mono font-bold text-sm text-gray-800">
                  {formatCurrencyBRL(a.payable_amount)}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
