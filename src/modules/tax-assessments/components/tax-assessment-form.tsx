'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTaxAssessmentAction } from '../actions'
import { TaxAssessmentOption } from '../settings/options'
import { AlertCircle, Save } from 'lucide-react'

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

interface TaxAssessmentFormProps {
  defaultCompetence?: string
  taxOptions: TaxAssessmentOption[]
}

function monthValueFromCompetence(competence: string | undefined) {
  return competence ? competence.substring(0, 7) : ''
}

function competenceFromMonth(monthValue: string) {
  return monthValue ? `${monthValue}-01` : ''
}

export function TaxAssessmentForm({ defaultCompetence, taxOptions }: TaxAssessmentFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [taxType, setTaxType] = useState<string>(taxOptions[0]?.value || '')
  const [competenceMonth, setCompetenceMonth] = useState(monthValueFromCompetence(defaultCompetence))
  const [dueDate, setDueDate] = useState('')
  const hasTaxOptions = taxOptions.length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasTaxOptions || !taxType) {
      setErrorMsg('Nenhum tributo habilitado para apuração nesta empresa. Ajuste em Fiscal > Configurações Tributárias.')
      return
    }
    setErrorMsg(null)
    startTransition(async () => {
      const res = await createTaxAssessmentAction({ taxType, competence: competenceFromMonth(competenceMonth), dueDate })
      if (res.ok) {
        router.push(`/fiscal/apuracoes/${res.data.id}`)
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {!hasTaxOptions && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <span>Nenhum tributo está habilitado para apuração nesta empresa.</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Tributo *</label>
          <select className={inputClass} value={taxType} onChange={(e) => setTaxType(e.target.value)} disabled={!hasTaxOptions}>
            {taxOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {taxOptions.find((option) => option.value === taxType)?.description && (
            <p className="mt-1 text-[11px] text-gray-400">{taxOptions.find((option) => option.value === taxType)?.description}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Competência *</label>
          <input type="month" className={inputClass} value={competenceMonth} onChange={(e) => setCompetenceMonth(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>Vencimento</label>
          <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={() => router.push('/fiscal/apuracoes')} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer">
          Cancelar
        </button>
        <button type="submit" disabled={isPending || !hasTaxOptions} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer">
          <Save className="w-4 h-4" />
          {isPending ? 'Criando...' : 'Criar e Calcular'}
        </button>
      </div>
    </form>
  )
}
