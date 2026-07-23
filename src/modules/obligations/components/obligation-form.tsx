'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Obligation } from '../types'
import { createObligationAction, updateObligationAction } from '../actions'
import { AlertCircle, Save } from 'lucide-react'

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

const OBLIGATION_TYPES = ['DAS', 'ISS', 'ICMS', 'IPI', 'PIS_COFINS', 'IRPJ_CSLL', 'DCTFWEB', 'FGTS_DIGITAL', 'EFD_CONTRIBUICOES', 'EFD_ICMS_IPI', 'ECD', 'ECF', 'DEFIS', 'OTHER']

export function ObligationForm({ obligation }: { obligation?: Obligation }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    obligationType: (obligation?.obligation_type || 'DAS') as string,
    competence: obligation?.competence?.substring(0, 7) || '',
    amount: obligation ? Number(obligation.amount) : 0,
    dueDate: obligation?.due_date || '',
    barcode: obligation?.barcode || '',
    paymentCode: obligation?.payment_code || '',
    documentUrl: obligation?.document_url || '',
    notes: obligation?.notes || ''
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const payload = { ...form, competence: form.competence ? `${form.competence}-01` : '' }
      const res = obligation ? await updateObligationAction({ id: obligation.id, ...payload }) : await createObligationAction(payload)
      if (res.ok) {
        router.push('/obrigacoes')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tipo de Obrigação *</label>
            <select className={inputClass} value={form.obligationType} onChange={(e) => update('obligationType', e.target.value)}>
              {OBLIGATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Competência *</label>
            <input type="month" className={inputClass} value={form.competence} onChange={(e) => update('competence', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Valor</label>
            <input type="number" step="0.01" className={inputClass} value={form.amount} onChange={(e) => update('amount', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>Vencimento *</label>
            <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Código de Barras</label>
            <input className={inputClass} value={form.barcode} onChange={(e) => update('barcode', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Código de Pagamento</label>
            <input className={inputClass} value={form.paymentCode} onChange={(e) => update('paymentCode', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>URL do Documento/Guia</label>
            <input className={inputClass} value={form.documentUrl} onChange={(e) => update('documentUrl', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Observações</label>
            <textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push('/obrigacoes')} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer">
          <Save className="w-4 h-4" />
          {isPending ? 'Salvando...' : obligation ? 'Salvar Alterações' : 'Criar Obrigação'}
        </button>
      </div>
    </form>
  )
}
