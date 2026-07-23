'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BankStatementLine, BankStatementLineStatus } from '../types'
import { BankStatementLineCard } from './bank-statement-line-card'
import { ListChecks, Search } from 'lucide-react'

interface BankStatementLineListProps {
  lines: BankStatementLine[]
  bankAccounts: { id: string; bank_name: string | null }[]
}

const STATUS_OPTIONS: { value: BankStatementLineStatus | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'CLASSIFIED', label: 'Classificada' },
  { value: 'RECONCILED', label: 'Conciliada' },
  { value: 'IGNORED', label: 'Ignorada' },
  { value: 'ERROR', label: 'Erro' }
]

export function BankStatementLineList({ lines, bankAccounts }: BankStatementLineListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [bankAccountId, setBankAccountId] = useState(searchParams.get('bankAccountId') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '')
  const [text, setText] = useState(searchParams.get('text') || '')

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault()
    const params = new URLSearchParams()
    if (bankAccountId) params.set('bankAccountId', bankAccountId)
    if (status) params.set('status', status)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    if (text) params.set('text', text)
    router.push(`/bancos/conciliacao?${params.toString()}`)
  }

  const inputClass = 'px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'

  return (
    <div className="space-y-4">
      <form onSubmit={applyFilters} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Conta Bancária</label>
          <select className={inputClass} value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
            <option value="">Todas</option>
            {bankAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.bank_name || 'Banco'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Status</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">De</label>
          <input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Até</label>
          <input type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Buscar descrição</label>
          <input className={inputClass + ' w-full'} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex: PIX, tarifa..." />
        </div>
        <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer">
          <Search className="w-3.5 h-3.5" />
          Filtrar
        </button>
      </form>

      {lines.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
          <ListChecks className="w-8 h-8 text-gray-300" />
          <span className="text-sm font-semibold text-gray-600">Nenhuma linha de extrato encontrada</span>
          <p className="text-xs text-gray-400 max-w-xs">Ajuste os filtros ou importe um novo extrato.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lines.map((line) => (
            <BankStatementLineCard key={line.id} line={line} />
          ))}
        </div>
      )}
    </div>
  )
}
