'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TaxAssessment } from '../types'
import { adjustTaxAssessmentAction, reviewTaxAssessmentAction, closeTaxAssessmentAction, cancelTaxAssessmentAction } from '../actions'
import { TaxAssessmentRecalculateButton } from './tax-assessment-recalculate-button'
import { CheckCircle2, Lock, Ban, AlertCircle, CheckCircle } from 'lucide-react'

export function TaxAssessmentWorkflowActions({ assessment }: { assessment: TaxAssessment }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showAdjust, setShowAdjust] = useState(false)
  const [fineAmount, setFineAmount] = useState(Number(assessment.fine_amount || 0))
  const [interestAmount, setInterestAmount] = useState(Number(assessment.interest_amount || 0))

  function run(action: () => Promise<any>) {
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await action()
      if (res.ok) {
        setSuccessMsg(res.message)
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  const canAdjust = assessment.status === 'DRAFT' || assessment.status === 'CALCULATED' || assessment.status === 'REVIEWED'
  const canReview = assessment.status === 'CALCULATED'
  const canClose = assessment.status === 'CALCULATED' || assessment.status === 'REVIEWED'
  const canCancel = assessment.status !== 'CLOSED' && assessment.status !== 'CANCELLED' && !assessment.journal_entry_id

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
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

      <div className="flex flex-wrap items-center gap-2">
        <TaxAssessmentRecalculateButton assessment={assessment} />
        {canAdjust && (
          <button onClick={() => setShowAdjust((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-gray-400 text-xs font-semibold rounded-lg cursor-pointer">
            Multa / Juros
          </button>
        )}
        {canReview && (
          <button onClick={() => run(() => reviewTaxAssessmentAction({ id: assessment.id }))} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Revisar
          </button>
        )}
        {canClose && (
          <button onClick={() => run(() => closeTaxAssessmentAction({ id: assessment.id }))} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
            <Lock className="w-3.5 h-3.5" />
            Fechar
          </button>
        )}
        {canCancel && (
          <button onClick={() => { if (window.confirm('Cancelar esta apuração?')) run(() => cancelTaxAssessmentAction({ id: assessment.id })) }} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
            <Ban className="w-3.5 h-3.5" />
            Cancelar
          </button>
        )}
      </div>

      {showAdjust && canAdjust && (
        <div className="border-t border-gray-100 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Multa</label>
            <input type="number" step="0.01" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs" value={fineAmount} onChange={(e) => setFineAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Juros</label>
            <input type="number" step="0.01" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs" value={interestAmount} onChange={(e) => setInterestAmount(Number(e.target.value))} />
          </div>
          <button
            onClick={() => run(() => adjustTaxAssessmentAction({ id: assessment.id, fineAmount, interestAmount }))}
            disabled={isPending}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
          >
            Salvar Multa/Juros
          </button>
        </div>
      )}
    </div>
  )
}
