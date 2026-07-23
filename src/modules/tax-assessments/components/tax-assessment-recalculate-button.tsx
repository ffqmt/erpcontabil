'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TaxAssessment } from '../types'
import { calculateTaxAssessmentAction, calculateIncomeTaxAssessmentAction } from '../actions'
import { Calculator, AlertCircle } from 'lucide-react'

// Botão único para o primeiro cálculo E para recálculo — a diferença é só o aviso de
// impacto: recalcular substitui as linhas AUTOMÁTICAS (documentos/retenções) pelas atuais
// da competência, mas nunca mexe nas linhas MANUAIS (créditos/débitos/ajustes lançados à
// mão continuam intactos).
export function TaxAssessmentRecalculateButton({ assessment }: { assessment: TaxAssessment }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (assessment.status !== 'DRAFT' && assessment.status !== 'CALCULATED') return null

  const isRecalculation = assessment.status === 'CALCULATED'
  const isIncomeTax = assessment.tax_type === 'IRPJ' || assessment.tax_type === 'CSLL'

  function handleClick() {
    if (isRecalculation) {
      const confirmed = window.confirm(
        isIncomeTax
          ? 'Recalcular vai substituir a linha de imposto devido pela apuração atual (Presumido/Real). Ajustes de Lucro Real e o saldo credor anterior NÃO são afetados. Continuar?'
          : 'Recalcular vai substituir as linhas automáticas (geradas de documentos fiscais e retenções) pelas atuais da competência. Linhas manuais e o saldo credor anterior NÃO são afetados. Continuar?'
      )
      if (!confirmed) return
    }
    setErrorMsg(null)
    startTransition(async () => {
      const res = isIncomeTax ? await calculateIncomeTaxAssessmentAction({ id: assessment.id }) : await calculateTaxAssessmentAction({ id: assessment.id })
      if (res.ok) router.refresh()
      else setErrorMsg(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button onClick={handleClick} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer w-fit">
        <Calculator className="w-3.5 h-3.5" />
        {isPending ? 'Calculando...' : isRecalculation ? 'Recalcular' : 'Calcular'}
      </button>
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded-lg text-xs font-semibold flex gap-2 items-start w-fit">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
