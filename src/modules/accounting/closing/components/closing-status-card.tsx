'use client'

import React from 'react'
import { ClosingStatus } from '../types'
import { CheckCircle2, AlertTriangle, AlertCircle, Bookmark, ShieldAlert, Lock, Unlock } from 'lucide-react'

interface ClosingStatusCardProps {
  status: ClosingStatus
  activeCompetence: string
}

export function ClosingStatusCard({
  status,
  activeCompetence
}: ClosingStatusCardProps) {
  const {
    periodStatus,
    hasDrafts,
    hasClosing,
    closingEntryNumber,
    equityResultAccount,
    draftsCount
  } = status

  const isPeriodOpen = periodStatus === 'OPEN' || periodStatus === 'REOPENED'
  const canClose = isPeriodOpen && !hasDrafts && !hasClosing && !!equityResultAccount

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Bloco 1: Período e Escrita */}
      <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm space-y-3">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Status da Competência</span>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border ${
            isPeriodOpen 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : 'bg-red-50 text-red-700 border-red-100'
          }`}>
            {isPeriodOpen ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <span className="text-sm font-bold text-gray-800 block">
              {isPeriodOpen ? 'Escrita Permitida (Aberto)' : 'Período Trancado (Fechado)'}
            </span>
            <span className="text-xs text-gray-400">
              {isPeriodOpen ? 'Aberto para novas postagens' : 'Nenhuma alteração é permitida'}
            </span>
          </div>
        </div>
      </div>

      {/* Bloco 2: Lançamentos Pendentes */}
      <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm space-y-3">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Lançamentos Rascunho</span>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border ${
            hasDrafts 
              ? 'bg-amber-50 text-amber-700 border-amber-100'
              : 'bg-green-50 text-green-700 border-green-100'
          }`}>
            {hasDrafts ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div>
            <span className="text-sm font-bold text-gray-800 block">
              {hasDrafts ? `${draftsCount} Rascunho(s) pendente(s)` : 'Nenhum rascunho pendente'}
            </span>
            <span className="text-xs text-gray-400">
              {hasDrafts ? 'Zere ou publique todos os rascunhos' : 'Pronto para encerramento'}
            </span>
          </div>
        </div>
      </div>

      {/* Bloco 3: Status do Encerramento */}
      <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm space-y-3">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Estado de Resultado</span>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border ${
            hasClosing 
              ? 'bg-blue-50 text-blue-700 border-blue-100'
              : 'bg-gray-50 text-gray-400 border-gray-150'
          }`}>
            <Bookmark className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-800 block">
              {hasClosing ? `Resultado Encerrado (Lançamento #${closingEntryNumber})` : 'Encerramento Pendente'}
            </span>
            <span className="text-xs text-gray-400">
              {hasClosing ? 'Contas de resultado zeradas fisicamente' : 'Zerar receitas e despesas'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
