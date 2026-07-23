'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChartAccount } from '../../accounts/types'
import { JournalEntry } from '../types'
import { JournalEntryForm, JournalEntryFormInitialValues } from './journal-entry-form'
import { JournalEntryList } from './journal-entry-list'
import { Plus, Landmark, Copy, Search, RotateCcw } from 'lucide-react'

interface JournalManagementPanelProps {
  accounts: ChartAccount[]
  entries: JournalEntry[]
  competence: string
  dateRange: { startDate: string; endDate: string }
  periodStatusByCompetence: Record<string, string>
  isClosed?: boolean
  partners: { id: string; name: string }[]
}

// Etapa 30A — "Novo a partir deste"/"Duplicar" (inspirado em duplicarUltimoLancamento()/
// novoApartirDeste() do protótipo legado sistema.html): converte um lançamento existente
// em valores iniciais para um novo formulário DRAFT. keepOriginalDate=true reproduz
// exatamente o comportamento do legado "novo a partir deste" (mesma data); false usa hoje
// (comportamento de "copiar último" para lançamentos recorrentes de datas diferentes).
function entryToInitialValues(entry: JournalEntry, keepOriginalDate: boolean): JournalEntryFormInitialValues {
  const todayIso = new Date().toISOString().slice(0, 10)
  return {
    entryDate: keepOriginalDate ? entry.entry_date : todayIso,
    description: entry.description,
    document: entry.document || '',
    partnerId: entry.partner_id || '',
    lines: entry.lines.map((l) => ({
      id: crypto.randomUUID(),
      accountId: l.account_id,
      debitCredit: l.debit_credit,
      amount: typeof l.amount === 'string' ? parseFloat(l.amount) : l.amount,
      memo: l.memo || ''
    }))
  }
}

export function JournalManagementPanel({
  accounts,
  entries,
  competence,
  dateRange,
  periodStatusByCompetence,
  isClosed = false,
  partners
}: JournalManagementPanelProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [formInitialValues, setFormInitialValues] = useState<JournalEntryFormInitialValues | undefined>(undefined)
  const [startDate, setStartDate] = useState(dateRange.startDate)
  const [endDate, setEndDate] = useState(dateRange.endDate)

  // Lançamento mais recente (por data, depois por criação) — usado por "Copiar Último".
  const lastEntry = [...entries].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? 1 : -1
    return a.created_at < b.created_at ? 1 : -1
  })[0]

  const handleSuccess = () => {
    setShowForm(false)
    setFormInitialValues(undefined)
  }

  const handleOpenBlank = () => {
    setFormInitialValues(undefined)
    setShowForm(true)
  }

  const handleCopyLast = () => {
    if (!lastEntry) return
    setFormInitialValues(entryToInitialValues(lastEntry, false))
    setShowForm(true)
  }

  const handleDuplicateEntry = (entry: JournalEntry) => {
    if (entry.status === 'POSTED' && !window.confirm(`Duplicar o lançamento nº ${entry.number}? Um novo rascunho será criado com os mesmos dados — nada no lançamento original é alterado.`)) {
      return
    }
    setFormInitialValues(entryToInitialValues(entry, true))
    setShowForm(true)
  }

  const handleApplyDateFilter = (event: React.FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    router.push(`/contabilidade/lancamentos?${params.toString()}`)
  }

  const handleResetDateFilter = () => {
    setStartDate(competence)
    setEndDate('')
    router.push('/contabilidade/lancamentos')
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleApplyDateFilter} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1">
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Data inicial</label>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Data final</label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer">
            <Search className="w-3.5 h-3.5" />
            Aplicar
          </button>
          <button type="button" onClick={handleResetDateFilter} className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 hover:border-emerald-300 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
            Mês atual
          </button>
        </div>
      </form>

      {/* Botões Rápidos e Modais */}
      {!showForm ? (
        <div className="flex justify-end gap-3">
          <>
            {lastEntry && (
              <button
                onClick={handleCopyLast}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                title="Pré-preenche um novo rascunho com os dados do último lançamento (data de hoje)"
              >
                <Copy className="w-4 h-4" /> Copiar Último
              </button>
            )}
            <button
              onClick={handleOpenBlank}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Novo Lançamento Manual
            </button>
          </>
        </div>
      ) : (
        /* Formulário de Criação */
        <div className="animate-fade-in">
          <JournalEntryForm
            accounts={accounts}
            partners={partners}
            competence={competence}
            onClose={() => { setShowForm(false); setFormInitialValues(undefined) }}
            onSuccess={handleSuccess}
            initialValues={formInitialValues}
          />
        </div>
      )}

      {/* Listagem de Lançamentos Existentes */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-gray-400" />
          Lançamentos no Intervalo
        </h3>

        <JournalEntryList entries={entries} isClosed={isClosed} periodStatusByCompetence={periodStatusByCompetence} onDuplicate={handleDuplicateEntry} />
      </div>
    </div>
  )
}
