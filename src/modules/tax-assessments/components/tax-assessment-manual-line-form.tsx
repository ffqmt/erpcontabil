'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TaxAssessmentLine } from '../types'
import { addTaxAssessmentManualLineAction, updateTaxAssessmentManualLineAction } from '../actions'
import { AlertCircle, Plus } from 'lucide-react'

const inputClass = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelClass = 'text-[10px] text-gray-400 block mb-1'

const LINE_TYPE_OPTIONS = [
  { value: 'CREDIT', label: 'Crédito' },
  { value: 'DEBIT', label: 'Débito' },
  { value: 'RETENTION', label: 'Retenção' },
  { value: 'ADJUSTMENT_POSITIVE', label: 'Ajuste (+)' },
  { value: 'ADJUSTMENT_NEGATIVE', label: 'Ajuste (-)' }
]

export function TaxAssessmentManualLineForm({ taxAssessmentId, line, onDone }: { taxAssessmentId: string; line?: TaxAssessmentLine; onDone?: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lineType, setLineType] = useState(line?.line_type || 'CREDIT')
  const [description, setDescription] = useState(line?.description || '')
  const [amount, setAmount] = useState(line ? Number(line.amount) : 0)
  const [baseAmount, setBaseAmount] = useState(line?.base_amount ? Number(line.base_amount) : 0)
  const [taxRate, setTaxRate] = useState(line?.tax_rate ? Number(line.tax_rate) : 0)
  const [notes, setNotes] = useState(line?.notes || '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const payload = {
        taxAssessmentId,
        lineType,
        description,
        amount,
        baseAmount: baseAmount || undefined,
        taxRate: taxRate || undefined,
        notes
      }
      const res = line
        ? await updateTaxAssessmentManualLineAction({ id: line.id, ...payload })
        : await addTaxAssessmentManualLineAction(payload)

      if (res.ok) {
        router.refresh()
        if (onDone) onDone()
        if (!line) {
          setDescription('')
          setAmount(0)
          setBaseAmount(0)
          setTaxRate(0)
          setNotes('')
        }
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={labelClass}>Tipo *</label>
          <select className={inputClass} value={lineType} onChange={(e) => setLineType(e.target.value)}>
            {LINE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelClass}>Valor *</label>
          <input type="number" step="0.01" min="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
        </div>
        <div>
          <label className={labelClass}>Base de Cálculo</label>
          <input type="number" step="0.01" min="0" className={inputClass} value={baseAmount} onChange={(e) => setBaseAmount(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass}>Alíquota (%)</label>
          <input type="number" step="0.01" min="0" className={inputClass} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Descrição *</label>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} required />
      </div>
      <div>
        <label className={labelClass}>Observação (opcional)</label>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>
      <div className="flex justify-end gap-2">
        {onDone && (
          <button type="button" onClick={onDone} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={isPending || !description || amount <= 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
          {isPending ? 'Salvando...' : line ? 'Salvar Linha' : 'Adicionar Linha'}
        </button>
      </div>
    </form>
  )
}
