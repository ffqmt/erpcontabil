'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Obligation } from '../types'
import { formatCurrencyBRL, formatDateBR, isObligationOverdue } from '../utils'
import { ObligationStatusBadge } from './obligation-status-badge'
import { markObligationGeneratedAction, markObligationPaidAction, markObligationDeliveredAction, cancelObligationAction } from '../actions'
import { FileText, AlertCircle } from 'lucide-react'

export function ObligationCard({ obligation }: { obligation: Obligation }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showPay, setShowPay] = useState(false)
  const [journalEntryNumber, setJournalEntryNumber] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().substring(0, 10))
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function run(action: () => Promise<any>) {
    setErrorMsg(null)
    startTransition(async () => {
      const res = await action()
      if (!res.ok) setErrorMsg(res.error)
      else router.refresh()
    })
  }

  function handlePay() {
    if (!journalEntryNumber) return
    run(() => markObligationPaidAction({ id: obligation.id, journalEntryNumber: Number(journalEntryNumber), paidAt }))
    setShowPay(false)
  }

  const isOverdue = isObligationOverdue(obligation.status, obligation.due_date)

  return (
    <div className={`bg-white border rounded-xl p-4 space-y-3 ${isOverdue ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 flex-shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-800 text-sm">{obligation.obligation_type}</span>
              <ObligationStatusBadge status={obligation.status} />
              {isOverdue && obligation.status !== 'OVERDUE' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border bg-red-50 text-red-700 border-red-200">Vencida</span>
              )}
            </div>
            <p className="text-[11px] text-gray-400">
              Vencimento {formatDateBR(obligation.due_date)}
              {obligation.payment_journal_entry?.number ? ` · Lançamento nº ${obligation.payment_journal_entry.number}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="font-mono font-bold text-sm text-gray-800">{formatCurrencyBRL(obligation.amount)}</span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        {obligation.status === 'OPEN' && (
          <button onClick={() => run(() => markObligationGeneratedAction({ id: obligation.id }))} disabled={isPending} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
            Marcar Gerada
          </button>
        )}
        {(obligation.status === 'OPEN' || obligation.status === 'GENERATED' || obligation.status === 'OVERDUE') && !showPay && (
          <button onClick={() => setShowPay(true)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg cursor-pointer">
            Marcar Paga
          </button>
        )}
        {obligation.status !== 'CANCELLED' && obligation.status !== 'DELIVERED' && (
          <button onClick={() => run(() => markObligationDeliveredAction({ id: obligation.id }))} disabled={isPending} className="px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-gray-400 text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
            Marcar Entregue
          </button>
        )}
        {!obligation.payment_journal_entry_id && obligation.status !== 'CANCELLED' && (
          <button onClick={() => { if (window.confirm('Cancelar esta obrigação?')) run(() => cancelObligationAction({ id: obligation.id })) }} disabled={isPending} className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
            Cancelar
          </button>
        )}
      </div>

      {showPay && (
        <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Nº do Lançamento Contábil</label>
            <input type="number" className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs w-32" value={journalEntryNumber} onChange={(e) => setJournalEntryNumber(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Data do Pagamento</label>
            <input type="date" className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <button onClick={handlePay} disabled={isPending || !journalEntryNumber} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
            Confirmar
          </button>
        </div>
      )}
    </div>
  )
}
