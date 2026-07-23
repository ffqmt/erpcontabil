'use client'

import React, { useState, useMemo } from 'react'
import { JournalEntry } from '../types'
import { JournalSummary } from './journal-summary'
import { JournalFilters, JournalFilterState } from './journal-filters'
import { JournalEntryCard } from './journal-entry-card'
import { BookOpen, HelpCircle } from 'lucide-react'

interface JournalListProps {
  entries: JournalEntry[]
}

export function JournalList({ entries }: JournalListProps) {
  const [filters, setFilters] = useState<JournalFilterState>({
    search: '',
    origin: '',
    startDate: '',
    endDate: ''
  })

  // Filtra lançamentos no lado do cliente
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // 1. Filtro de pesquisa (Número, Histórico principal, ou contas vinculadas)
      if (filters.search) {
        const term = filters.search.toLowerCase()
        
        const matchNum = entry.number?.toString().includes(term)
        const matchDesc = entry.description.toLowerCase().includes(term)
        
        // Verifica se o termo bate com código ou nome de qualquer conta contábil nas linhas
        const matchLineAcc = entry.lines.some((l) => {
          const codeMatch = l.account?.code.toLowerCase().includes(term)
          const nameMatch = l.account?.name.toLowerCase().includes(term)
          const memoMatch = l.memo?.toLowerCase().includes(term)
          return codeMatch || nameMatch || memoMatch
        })

        if (!matchNum && !matchDesc && !matchLineAcc) return false
      }

      // 2. Filtro de Origem
      if (filters.origin && entry.origin !== filters.origin) {
        return false
      }

      // 3. Filtro de data inicial
      if (filters.startDate && entry.entry_date < filters.startDate) {
        return false
      }

      // 4. Filtro de data final
      if (filters.endDate && entry.entry_date > filters.endDate) {
        return false
      }

      return true
    })
  }, [entries, filters])

  // Calcula valores somados para o resumo com base nas entries FILTRADAS
  const summaryStats = useMemo(() => {
    let debits = 0
    let credits = 0

    filteredEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        const val = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
        if (!isNaN(val)) {
          if (line.debit_credit === 'DEBIT') {
            debits += val
          } else {
            credits += val
          }
        }
      })
    })

    return {
      count: filteredEntries.length,
      debits,
      credits
    }
  }, [filteredEntries])

  return (
    <div className="space-y-6">
      {/* Resumo superior dos lançamentos mostrados */}
      <div className="print:hidden">
        <JournalSummary
          totalCount={summaryStats.count}
          totalDebits={summaryStats.debits}
          totalCredits={summaryStats.credits}
        />
      </div>

      {/* Seção de Filtros */}
      <div className="print:hidden">
        <JournalFilters onFilterChange={setFilters} />
      </div>

      {/* Lista de Cards de Lançamentos */}
      <div className="space-y-6">
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => (
            <JournalEntryCard key={entry.id} entry={entry} />
          ))
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center max-w-md mx-auto space-y-3 shadow-sm">
            <div className="p-3 bg-gray-50 text-gray-400 rounded-full w-fit mx-auto">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-gray-700">Nenhum lançamento encontrado</h4>
            <p className="text-sm text-gray-500">
              Não há lançamentos de diário publicados que correspondam aos filtros informados.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
