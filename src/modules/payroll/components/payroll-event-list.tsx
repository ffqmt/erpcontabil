'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Users } from 'lucide-react'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { PayrollEsocialEvent } from '../types'
import { ESOCIAL_EVENT_LABELS, PAYROLL_ACCOUNTING_STATUS_LABELS, formatCompetenceBR, formatCurrencyBRL, formatDateBR } from '../utils'
import { PayrollAccountingForm } from './payroll-accounting-form'

interface PayrollEventListProps {
  events: PayrollEsocialEvent[]
  accounts: ChartAccount[]
}

const inputClass = 'px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'

function statusClass(status: string) {
  if (status === 'ACCOUNTED') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (status === 'ACCOUNTING_ERROR') return 'bg-red-50 text-red-700 border-red-100'
  return 'bg-amber-50 text-amber-700 border-amber-100'
}

export function PayrollEventList({ events, accounts }: PayrollEventListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [competence, setCompetence] = useState(searchParams.get('competence') || '')
  const [eventType, setEventType] = useState(searchParams.get('eventType') || '')
  const [accountingStatus, setAccountingStatus] = useState(searchParams.get('accountingStatus') || '')
  const [text, setText] = useState(searchParams.get('text') || '')

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault()
    const params = new URLSearchParams()
    if (competence) params.set('competence', competence)
    if (eventType) params.set('eventType', eventType)
    if (accountingStatus) params.set('accountingStatus', accountingStatus)
    if (text) params.set('text', text)
    router.push(`/folha?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={applyFilters} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Competência</label>
          <input type="month" className={inputClass} value={competence} onChange={(e) => setCompetence(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Evento</label>
          <select className={inputClass} value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ESOCIAL_EVENT_LABELS).filter(([key]) => key !== 'ESOCIAL').map(([key, label]) => (
              <option key={key} value={key}>{key} — {label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Contabilização</label>
          <select className={inputClass} value={accountingStatus} onChange={(e) => setAccountingStatus(e.target.value)}>
            <option value="">Todas</option>
            <option value="NOT_ACCOUNTED">Não Contabilizado</option>
            <option value="ACCOUNTED">Contabilizado</option>
            <option value="ACCOUNTING_ERROR">Erro</option>
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Buscar ID/CPF/Nome</label>
          <input className={`${inputClass} w-full`} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg cursor-pointer">
          <Search className="w-3.5 h-3.5" />
          Filtrar
        </button>
      </form>

      {events.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
          <Users className="w-8 h-8 text-gray-300" />
          <span className="text-sm font-semibold text-gray-600">Nenhum evento eSocial importado</span>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <article key={event.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-gray-800">{event.event_type}</span>
                    <span className="text-xs text-gray-500">{event.event_name || ESOCIAL_EVENT_LABELS[event.event_type] || 'Evento eSocial'}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusClass(event.accounting_status)}`}>
                      {PAYROLL_ACCOUNTING_STATUS_LABELS[event.accounting_status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 truncate">{event.event_id || 'Evento sem ID identificado'}</p>
                </div>
                <div className="text-xs text-gray-500 lg:text-right">
                  <p>Competência <strong className="text-gray-800">{formatCompetenceBR(event.period_competence)}</strong></p>
                  <p>Pagamento <strong className="text-gray-800">{formatDateBR(event.payment_date)}</strong></p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="block text-gray-400 uppercase text-[10px] font-bold">Trabalhador</span>
                  <span className="font-semibold text-gray-800">{event.worker_name || event.worker_cpf || '—'}</span>
                  {event.worker_name && <span className="block text-gray-500">{event.worker_cpf || '—'}</span>}
                </div>
                <div>
                  <span className="block text-gray-400 uppercase text-[10px] font-bold">Bruto</span>
                  <span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(event.gross_amount)}</span>
                </div>
                <div>
                  <span className="block text-gray-400 uppercase text-[10px] font-bold">Descontos</span>
                  <span className="font-mono font-bold text-amber-700">{formatCurrencyBRL(event.deductions_amount)}</span>
                </div>
                <div>
                  <span className="block text-gray-400 uppercase text-[10px] font-bold">Líquido</span>
                  <span className="font-mono font-bold text-emerald-700">{formatCurrencyBRL(event.net_amount)}</span>
                </div>
              </div>

              {event.items && event.items.length > 0 && (
                <div className="border-t border-gray-100 pt-3 overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-gray-400">
                        <th className="py-1 pr-3">Rubrica</th>
                        <th className="py-1 pr-3">Tipo</th>
                        <th className="py-1 pr-3">Natureza</th>
                        <th className="py-1 pr-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {event.items.slice(0, 6).map((item) => (
                        <tr key={item.id} className="border-t border-gray-50">
                          <td className="py-1.5 pr-3 font-mono text-gray-700">{item.rubric_code || '—'}</td>
                          <td className="py-1.5 pr-3 text-gray-500">{item.line_type}</td>
                          <td className="py-1.5 pr-3 text-gray-500">{item.rubric_nature || '—'}</td>
                          <td className="py-1.5 pr-3 text-right font-mono font-semibold text-gray-800">{formatCurrencyBRL(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {event.items.length > 6 && <p className="text-[11px] text-gray-400 mt-2">+ {event.items.length - 6} rubrica(s)</p>}
                </div>
              )}

              <PayrollAccountingForm event={event} accounts={accounts} />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
