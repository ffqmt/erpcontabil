'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TaxAssessment } from '../types'
import { generateObligationFromAssessmentAction } from '@/modules/obligations/actions'
import { AlertCircle, CheckCircle, FileOutput } from 'lucide-react'

export function GenerateObligationButton({ assessment }: { assessment: TaxAssessment }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [show, setShow] = useState(false)
  const [obligationType, setObligationType] = useState<string>(assessment.tax_type)
  const [dueDate, setDueDate] = useState(assessment.due_date || '')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (assessment.status !== 'CLOSED') return null
  if (assessment.obligation_id) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-xs text-green-800">
        Obrigação já gerada a partir desta apuração.
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await generateObligationFromAssessmentAction({ taxAssessmentId: assessment.id, obligationType, dueDate })
      if (res.ok) {
        setSuccessMsg(res.message || 'Obrigação gerada.')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold rounded-lg cursor-pointer">
        <FileOutput className="w-3.5 h-3.5" />
        Gerar Obrigação/Guia
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-2.5 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[10px] text-gray-400 block mb-1">Tipo de Obrigação</label>
          <input className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs" value={obligationType} onChange={(e) => setObligationType(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 block mb-1">Vencimento</label>
          <input type="date" className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <button type="submit" disabled={isPending} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
          Confirmar
        </button>
      </div>
    </form>
  )
}
