'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TaxAssessment } from '../types'
import { updateTaxAssessmentPreviousBalanceAction } from '../actions'
import { formatCurrencyBRL } from '../utils'
import { AlertCircle, Save } from 'lucide-react'

export function TaxAssessmentPreviousBalanceForm({ assessment }: { assessment: TaxAssessment }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(Number(assessment.previous_balance_amount || 0))
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [show, setShow] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const res = await updateTaxAssessmentPreviousBalanceAction({ id: assessment.id, previousBalanceAmount: value })
      if (res.ok) {
        router.refresh()
        setShow(false)
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer underline decoration-dotted">
        {Number(assessment.previous_balance_amount || 0) > 0
          ? `Saldo credor anterior: ${formatCurrencyBRL(assessment.previous_balance_amount)} — editar`
          : 'Informar saldo credor do período anterior'}
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex flex-wrap items-end gap-3">
      {errorMsg && (
        <div className="w-full bg-red-50 border border-red-200 text-red-800 p-2 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      <div>
        <label className="text-[10px] text-gray-400 block mb-1">Saldo Credor do Período Anterior (reduz o valor a recolher)</label>
        <input type="number" step="0.01" min="0" className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs w-48" value={value} onChange={(e) => setValue(Number(e.target.value))} />
      </div>
      <button type="submit" disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
        <Save className="w-3.5 h-3.5" />
        Salvar
      </button>
      <button type="button" onClick={() => setShow(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">
        Cancelar
      </button>
    </form>
  )
}
