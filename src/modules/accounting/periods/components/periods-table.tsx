'use client'

import React from 'react'
import { AccountingPeriod } from '../types'
import { PeriodStatusBadge } from './period-status-badge'
import { formatCurrencyBRL, formatCompetenceBR, formatDateBR } from '../period-utils'
import { Lock, Unlock, AlertTriangle, Scale } from 'lucide-react'

interface PeriodsTableProps {
  periods: AccountingPeriod[]
  activeCompetence: string
  onClosePeriod: (id: string) => void
  onReopenPeriod: (id: string) => void
  isPending: boolean
}

export function PeriodsTable({
  periods,
  activeCompetence,
  onClosePeriod,
  onReopenPeriod,
  isPending
}: PeriodsTableProps) {
  // Normaliza competência para comparação
  const normalizeComp = (c: string) => c.substring(0, 7) // YYYY-MM
  const normalizedActive = normalizeComp(activeCompetence)

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50/30 flex items-center justify-between">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Histórico de Competências</h4>
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Mês Fiscal / Contábil</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse border-spacing-0">
          <thead>
            <tr className="bg-gray-150/40 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3.5 w-40">Competência</th>
              <th className="px-4 py-3.5 w-32">Status</th>
              <th className="px-4 py-3.5 text-center w-28">Publicados</th>
              <th className="px-4 py-3.5 text-center w-28">Rascunhos</th>
              <th className="px-4 py-3.5 text-right w-44">Débito / Crédito</th>
              <th className="px-4 py-3.5 text-right w-36">Diferença</th>
              <th className="px-4 py-3.5 w-44">Encerramento</th>
              <th className="px-4 py-3.5 text-right w-44">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white text-xs text-gray-650">
            {periods.map((period) => {
              const {
                id,
                competence,
                status,
                posted_count = 0,
                draft_count = 0,
                total_debits = 0,
                total_credits = 0,
                closed_at
              } = period

              const isCurrent = normalizeComp(competence) === normalizedActive
              const isOpen = status === 'OPEN' || status === 'REOPENED'
              
              const diff = Math.abs(total_debits - total_credits)
              const hasDiff = diff > 0.009

              return (
                <tr 
                  key={id} 
                  className={`hover:bg-gray-50/40 border-b border-gray-100 ${
                    isCurrent ? 'bg-emerald-50/10 font-medium' : ''
                  }`}
                >
                  {/* Competência */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{formatCompetenceBR(competence)}</span>
                      {isCurrent && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
                          Ativo
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <PeriodStatusBadge status={status} />
                  </td>

                  {/* Lançamentos Publicados */}
                  <td className="px-4 py-3.5 text-center font-mono font-medium text-gray-800">
                    {posted_count}
                  </td>

                  {/* Lançamentos Rascunho */}
                  <td className="px-4 py-3.5 text-center font-mono font-medium text-amber-700">
                    {draft_count}
                  </td>

                  {/* Somas */}
                  <td className="px-4 py-3.5 text-right font-mono text-gray-800">
                    {formatCurrencyBRL(total_debits)}
                  </td>

                  {/* Diferença */}
                  <td className={`px-4 py-3.5 text-right font-mono font-semibold ${
                    hasDiff ? 'text-red-650' : 'text-gray-400'
                  }`}>
                    {hasDiff ? (
                      <span className="flex items-center justify-end gap-1 text-red-650">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        {formatCurrencyBRL(diff)}
                      </span>
                    ) : (
                      'R$ 0,00'
                    )}
                  </td>

                  {/* Encerramento */}
                  <td className="px-4 py-3.5 text-gray-400 font-medium">
                    {closed_at ? formatDateBR(closed_at) : '-'}
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3.5 text-right">
                    {isOpen ? (
                      <button
                        onClick={() => onClosePeriod(id)}
                        disabled={isPending || draft_count > 0}
                        title={draft_count > 0 ? 'Não é possível fechar com rascunhos' : 'Fechar esta competência contábil'}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:text-white bg-white hover:bg-red-600 disabled:opacity-40 border border-red-200 rounded shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Lock className="w-3.5 h-3.5" /> Fechar
                      </button>
                    ) : (
                      <button
                        onClick={() => onReopenPeriod(id)}
                        disabled={isPending}
                        title="Reabrir esta competência contábil"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-white bg-white hover:bg-blue-600 disabled:opacity-40 border border-blue-200 rounded shadow-sm transition-all cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5" /> Reabrir
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
