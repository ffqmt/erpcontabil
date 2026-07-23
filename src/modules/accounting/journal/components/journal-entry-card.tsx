import React from 'react'
import { JournalEntry } from '../types'
import { formatDateBR, formatCurrencyBRL, getOriginLabel } from '../journal-utils'
import { JournalEntryLines } from './journal-entry-lines'
import { JournalStatusBadge } from './journal-status-badge'
import { FileText, Calendar, Hash, RefreshCw, Undo } from 'lucide-react'

interface JournalEntryCardProps {
  entry: JournalEntry
}

export function JournalEntryCard({ entry }: JournalEntryCardProps) {
  const { number, entry_date, description, origin, status, lines, reversal_of_id, reversed_by_entry_id, notes } = entry

  // Calcula o total do lançamento somando todas as linhas de DÉBITO
  const entryTotal = lines
    .filter((l) => l.debit_credit === 'DEBIT')
    .reduce((sum, l) => sum + (typeof l.amount === 'string' ? parseFloat(l.amount) : l.amount), 0)

  // Rótulos de estilo para as origens
  const getOriginBadgeStyle = (org: string) => {
    switch (org) {
      case 'OPENING':
        return 'bg-blue-50 text-blue-700 border border-blue-200'
      case 'MANUAL':
        return 'bg-gray-50 text-gray-700 border border-gray-200'
      case 'FISCAL_DOCUMENT':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      case 'PAYROLL_SUMMARY':
        return 'bg-purple-50 text-purple-700 border border-purple-200'
      case 'PAYROLL_PAYMENT':
        return 'bg-violet-50 text-violet-700 border border-violet-200'
      case 'REVERSAL':
        return 'bg-amber-50 text-amber-700 border border-amber-200'
      default:
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200'
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Detalhes do Cabeçalho */}
      <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-500">
          {/* Número do Lançamento */}
          <div className="flex items-center gap-1.5 text-gray-800 bg-white border border-gray-200 px-2 py-1 rounded">
            <Hash className="w-3.5 h-3.5 text-gray-400" />
            <span>Nº Lançamento: {number || 'DRAFT'}</span>
          </div>

          {/* Data de Emissão */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Data: {formatDateBR(entry_date)}</span>
          </div>

          {/* Origem */}
          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${getOriginBadgeStyle(origin)}`}>
            {getOriginLabel(origin)}
          </span>

          {/* Status */}
          <JournalStatusBadge status={status} />
        </div>

        {/* Valor Total do Lançamento */}
        <div className="flex flex-col md:text-right">
          <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Valor do Lançamento</span>
          <span className="text-base font-bold text-gray-800 font-mono">
            {formatCurrencyBRL(entryTotal)}
          </span>
        </div>
      </div>

      {/* Descrição / Histórico Geral */}
      <div className="p-4 border-b border-gray-100 text-sm text-gray-700 bg-white flex items-start gap-3">
        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1.5 flex-1">
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Histórico Contábil Geral</span>
            <p className="leading-relaxed font-sans">{description}</p>
          </div>

          {/* Justificativa de Estorno se houver */}
          {notes && (
            <div className="bg-amber-50/50 text-amber-900 border border-amber-100 p-2.5 rounded-lg text-xs font-medium space-y-1">
              <span className="text-[10px] text-amber-700 font-bold uppercase block tracking-wider">Justificativa do Estorno:</span>
              <p className="italic font-sans">{notes}</p>
            </div>
          )}

          {/* Relação de Vínculo: Este lançamento é um estorno */}
          {reversal_of_id && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded w-fit border border-amber-100 font-medium">
              <Undo className="w-3.5 h-3.5" />
              <span>Lançamento corretivo de estorno.</span>
            </div>
          )}

          {/* Relação de Vínculo: Este lançamento foi estornado */}
          {reversed_by_entry_id && (
            <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 px-2 py-1 rounded w-fit border border-rose-100 font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
              <span>Este lançamento foi anulado por estorno contábil.</span>
            </div>
          )}
        </div>
      </div>

      {/* Linhas Contábeis */}
      <div className="p-4 bg-white">
        <JournalEntryLines lines={lines} />
      </div>
    </div>
  )
}
