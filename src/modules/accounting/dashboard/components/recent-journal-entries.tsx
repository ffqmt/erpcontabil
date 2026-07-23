'use client'

import React from 'react'
import { JournalEntry } from '../../journal/types'
import { JournalStatusBadge } from '../../journal/components/journal-status-badge'
import { formatCurrencyBRL, formatDateBR } from '../dashboard-utils'
import { ArrowRight, BookOpen, Clock } from 'lucide-react'
import Link from 'next/link'

interface RecentJournalEntriesProps {
  entries: JournalEntry[]
}

export function RecentJournalEntries({ entries }: RecentJournalEntriesProps) {
  // Calcula o valor total de débitos/créditos de cada lançamento para exibir na lista
  const getEntryTotal = (entry: JournalEntry) => {
    return entry.lines
      .filter((l) => l.debit_credit === 'DEBIT')
      .reduce((sum, l) => {
        const val = typeof l.amount === 'string' ? parseFloat(l.amount) : l.amount
        return sum + (isNaN(val) ? 0 : val)
      }, 0)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 bg-gray-50/30 flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          Lançamentos Recentes
        </h3>
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Últimos Lançamentos</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 min-h-[250px]">
        {entries.length > 0 ? (
          entries.map((entry) => {
            const entryVal = getEntryTotal(entry)
            return (
              <div key={entry.id} className="p-3.5 hover:bg-gray-50/30 flex items-center justify-between gap-4 text-xs">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-800">
                      {entry.number ? `#${entry.number}` : 'Rascunho'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {formatDateBR(entry.entry_date)}
                    </span>
                    <span className="text-[9px] px-1 py-0.2 bg-gray-100 rounded text-gray-550 border border-gray-150 uppercase tracking-wider font-semibold">
                      {entry.origin}
                    </span>
                  </div>
                  <p className="text-gray-650 truncate font-medium pr-2" title={entry.description}>
                    {entry.description}
                  </p>
                </div>
                <div className="flex items-center gap-3.5 flex-shrink-0">
                  <span className="font-mono font-bold text-gray-900">
                    {formatCurrencyBRL(entryVal)}
                  </span>
                  <JournalStatusBadge status={entry.status} />
                </div>
              </div>
            )
          })
        ) : (
          <div className="p-8 text-center text-gray-400 flex flex-col justify-center items-center h-full gap-2">
            <BookOpen className="w-8 h-8 text-gray-300" />
            <span className="text-xs font-semibold text-gray-600">Nenhum lançamento no período</span>
            <p className="text-[10px] text-gray-400 leading-normal max-w-[200px]">Os lançamentos oficiais ou em rascunho criados constarão listados aqui.</p>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-150 bg-gray-50/30 text-center">
        <Link
          href="/contabilidade/diario"
          className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          Ver Diário Contábil Completo
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}
