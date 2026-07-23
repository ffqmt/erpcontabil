'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TaxAssessment } from '../types'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { accountTaxAssessmentAction } from '../actions'
import { formatCurrencyBRL } from '../utils'
import { AlertCircle, CheckCircle, Zap } from 'lucide-react'

interface TaxAssessmentAccountingFormProps {
  assessment: TaxAssessment
  chartAccounts: ChartAccount[]
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

export function TaxAssessmentAccountingForm({ assessment, chartAccounts }: TaxAssessmentAccountingFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [debitAccountId, setDebitAccountId] = useState('')
  const [creditAccountId, setCreditAccountId] = useState('')

  const eligible = chartAccounts.filter((a) => a.accepts_entries && !a.is_synthetic && a.is_active)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await accountTaxAssessmentAction({ id: assessment.id, debitAccountId, creditAccountId })
      if (res.ok) {
        setSuccessMsg(res.message || 'Apuração contabilizada.')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  if (assessment.status !== 'CLOSED') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-xs text-amber-800">
        A apuração precisa estar <strong>Fechada</strong> para ser contabilizada (status atual: {assessment.status}).
      </div>
    )
  }

  if (assessment.journal_entry_id) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-xs text-green-800">
        Já contabilizada{assessment.journal_entry?.number ? ` — lançamento nº ${assessment.journal_entry.number}` : ''}.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contabilizar Tributo a Recolher</h3>
      <p className="text-[11px] text-gray-400">
        Valor a provisionar: <strong>{formatCurrencyBRL(assessment.payable_amount)}</strong>. Débito na conta de despesa/dedução selecionada, crédito na conta de imposto a recolher selecionada.
      </p>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Conta de Débito (despesa/dedução) *</label>
          <select className={inputClass} value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)} required>
            <option value="">— Selecione —</option>
            {eligible.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Conta de Crédito (imposto a recolher) *</label>
          <select className={inputClass} value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)} required>
            <option value="">— Selecione —</option>
            {eligible.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button type="submit" disabled={isPending || !debitAccountId || !creditAccountId} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer">
        <Zap className="w-4 h-4" />
        {isPending ? 'Contabilizando...' : 'Gerar Lançamento de Provisão'}
      </button>
    </form>
  )
}
