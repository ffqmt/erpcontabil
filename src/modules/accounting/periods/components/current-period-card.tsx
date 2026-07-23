'use client'

import React from 'react'
import { AccountingPeriod } from '../types'
import { PeriodStatusBadge } from './period-status-badge'
import { formatCompetenceBR, formatDateBR } from '../period-utils'
import { Calendar, AlertTriangle, CheckCircle, Lock, Unlock } from 'lucide-react'

interface CurrentPeriodCardProps {
  period: AccountingPeriod
  onClosePeriod: (id: string) => void
  onReopenPeriod: (id: string) => void
  isPending: boolean
}

export function CurrentPeriodCard({
  period,
  onClosePeriod,
  onReopenPeriod,
  isPending
}: CurrentPeriodCardProps) {
  const { id, competence, status, closed_at, reopened_at, reopen_reason, posted_count = 0, draft_count = 0 } = period
  const isOpen = status === 'OPEN' || status === 'REOPENED'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
      {/* Informações da Competência */}
      <div className={`p-6 md:w-2/3 space-y-4 flex flex-col justify-between ${
        isOpen ? 'bg-gradient-to-br from-emerald-50/20 to-white' : 'bg-gradient-to-br from-red-50/20 to-white'
      }`}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
              Competência Ativa no Contexto
            </span>
            <PeriodStatusBadge status={status} />
          </div>
          
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            {formatCompetenceBR(competence)}
          </h3>
        </div>

        {/* Alerta Informativo */}
        {isOpen ? (
          <div className="flex gap-2 text-xs text-emerald-800 bg-emerald-50/70 p-3 rounded-lg border border-emerald-100 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p>
              O período contábil está **ABERTO**. Operações de inserção, modificação e estorno de lançamentos estão totalmente liberadas nesta competência.
              {status === 'REOPENED' && reopen_reason && (
                <span className="block mt-1 text-emerald-700">Motivo da reabertura: &ldquo;{reopen_reason}&rdquo;{reopened_at ? ` (${formatDateBR(reopened_at)})` : ''}</span>
              )}
            </p>
          </div>
        ) : (
          <div className="flex gap-2 text-xs text-red-800 bg-red-50/70 p-3 rounded-lg border border-red-100 font-medium">
            <AlertTriangle className="w-4 h-4 text-red-650 mt-0.5 flex-shrink-0" />
            <p>O período contábil está **FECHADO**. A criação de novos lançamentos contábeis, postagens de rascunhos e estornos estão bloqueados por integridade.</p>
          </div>
        )}
      </div>

      {/* Estatísticas e Ações Rápidas */}
      <div className="p-6 md:w-1/3 bg-gray-50/50 border-t md:border-t-0 md:border-l border-gray-200 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Estatísticas Operacionais</span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2 rounded-lg border border-gray-150">
              <span className="text-gray-400 block font-medium">Publicados</span>
              <strong className="text-sm text-gray-800 font-mono">{posted_count}</strong>
            </div>
            <div className="bg-white p-2 rounded-lg border border-gray-150">
              <span className="text-gray-400 block font-medium">Rascunhos</span>
              <strong className="text-sm text-amber-700 font-mono">{draft_count}</strong>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div>
          {isOpen ? (
            <button
              onClick={() => onClosePeriod(id)}
              disabled={isPending || draft_count > 0}
              title={draft_count > 0 ? 'Não é possível fechar com rascunhos pendentes' : ''}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              {isPending ? 'Processando...' : 'Fechar Período Contábil'}
            </button>
          ) : (
            <button
              onClick={() => onReopenPeriod(id)}
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              {isPending ? 'Processando...' : 'Reabrir Período Contábil'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
