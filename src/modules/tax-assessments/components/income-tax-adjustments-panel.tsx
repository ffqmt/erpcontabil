'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TaxAssessment, TaxAssessmentAdjustment } from '../types'
import { addTaxAssessmentAdjustmentAction, deleteTaxAssessmentAdjustmentAction } from '../actions'
import { AlertCircle, Plus, Trash2, Landmark } from 'lucide-react'

interface IncomeTaxAdjustmentsPanelProps {
  assessment: TaxAssessment
  editable: boolean
}

const ADJUSTMENT_LABELS: Record<string, string> = { ADDITION: 'Adição', EXCLUSION: 'Exclusão', COMPENSATION: 'Compensação' }

function formatCurrencyBRL(n: number | string | null | undefined): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (num === null || num === undefined || isNaN(num)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

export function IncomeTaxAdjustmentsPanel({ assessment, editable }: IncomeTaxAdjustmentsPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [adjustmentType, setAdjustmentType] = useState<'ADDITION' | 'EXCLUSION' | 'COMPENSATION'>('ADDITION')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)

  const adjustments = (assessment.adjustments || []) as TaxAssessmentAdjustment[]
  const memory = assessment.calculation_memory || {}

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const res = await addTaxAssessmentAdjustmentAction({
        assessmentId: assessment.id,
        taxType: assessment.tax_type as 'IRPJ' | 'CSLL',
        adjustmentType,
        description,
        amount
      })
      if (res.ok) {
        setDescription('')
        setAmount(0)
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  function handleDelete(id: string) {
    if (!window.confirm('Remover este ajuste?')) return
    startTransition(async () => {
      await deleteTaxAssessmentAdjustmentAction({ id, assessmentId: assessment.id })
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <Landmark className="w-3.5 h-3.5" />
        Ajustes de Lucro Real ({assessment.tax_type})
      </h3>

      {memory.netResult !== undefined && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-gray-50 rounded-lg p-3">
          <div><span className="text-[10px] text-gray-400 block">Resultado Contábil</span><span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(memory.netResult)}</span></div>
          <div><span className="text-[10px] text-gray-400 block">Adições</span><span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(memory.additions)}</span></div>
          <div><span className="text-[10px] text-gray-400 block">Exclusões</span><span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(memory.exclusions)}</span></div>
          <div><span className="text-[10px] text-gray-400 block">Base Fiscal</span><span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(memory.base)}</span></div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {adjustments.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum ajuste lançado ainda — o cálculo usa só o resultado contábil do período.</p>
      ) : (
        <div className="space-y-2">
          {adjustments.map((adj) => (
            <div key={adj.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-2.5 text-xs">
              <div>
                <span className="font-semibold text-gray-700">{ADJUSTMENT_LABELS[adj.adjustment_type]}</span>
                <span className="text-gray-400"> — {adj.description}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(adj.amount)}</span>
                {editable && (
                  <button onClick={() => handleDelete(adj.id)} disabled={isPending} className="text-red-500 hover:text-red-700 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editable && (
        <form onSubmit={handleAdd} className="border-t border-gray-100 pt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Tipo</label>
            <select className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value as any)}>
              <option value="ADDITION">Adição</option>
              <option value="EXCLUSION">Exclusão</option>
              <option value="COMPENSATION">Compensação</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-gray-400 block mb-0.5">Descrição</label>
            <input className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Ex.: Multa não dedutível" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Valor</label>
            <input type="number" step="0.01" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" disabled={isPending || !description || amount <= 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              Adicionar Ajuste
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
