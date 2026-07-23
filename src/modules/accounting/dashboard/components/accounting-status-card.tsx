'use client'

import React from 'react'
import { formatCompetenceBR } from '../dashboard-utils'
import { Lock, Unlock, HelpCircle, CheckCircle, Bookmark } from 'lucide-react'

interface AccountingStatusCardProps {
  competence: string
  periodStatus: 'OPEN' | 'IN_REVIEW' | 'CLOSED' | 'REOPENED'
  hasClosing: boolean
  closingEntryNumber?: string | number
}

export function AccountingStatusCard({
  competence,
  periodStatus,
  hasClosing,
  closingEntryNumber
}: AccountingStatusCardProps) {
  const isPeriodOpen = periodStatus === 'OPEN' || periodStatus === 'REOPENED'

  const getStatusBadge = () => {
    switch (periodStatus) {
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <Lock className="w-3.5 h-3.5" /> FECHADO
          </span>
        )
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <HelpCircle className="w-3.5 h-3.5" /> EM REVISÃO
          </span>
        )
      case 'REOPENED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Unlock className="w-3.5 h-3.5" /> REABERTO
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
            <Unlock className="w-3.5 h-3.5" /> ABERTO
          </span>
        )
    }
  }

  return (
    <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm space-y-4">
      <div className="flex justify-between items-start border-b border-gray-100 pb-3">
        <div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Competência Contábil</span>
          <h3 className="text-lg font-bold text-gray-800">{formatCompetenceBR(competence)}</h3>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-gray-500 font-medium">
          <span>Operações de Escrita:</span>
          <span className={isPeriodOpen ? 'text-green-700 font-bold' : 'text-red-750 font-bold'}>
            {isPeriodOpen ? 'Liberado' : 'Bloqueado'}
          </span>
        </div>
        <div className="flex justify-between text-gray-500 font-medium">
          <span>Encerramento de Resultado:</span>
          {hasClosing ? (
            <span className="text-green-700 font-bold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              Efetuado (#{closingEntryNumber})
            </span>
          ) : (
            <span className="text-amber-700 font-bold flex items-center gap-1">
              <Bookmark className="w-3.5 h-3.5 text-amber-500" />
              Pendente
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
