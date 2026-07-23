'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { createAssetCategoryAction } from '../actions'
import { AlertCircle, Save } from 'lucide-react'

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

export function AssetCategoryForm({ chartAccounts }: { chartAccounts: ChartAccount[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    defaultUsefulLifeMonths: 60,
    defaultAssetAccountId: '',
    defaultDepreciationAccountId: '',
    defaultExpenseAccountId: '',
    disposalGainAccountId: '',
    disposalLossAccountId: ''
  })

  const eligible = chartAccounts.filter((a) => a.accepts_entries && !a.is_synthetic && a.is_active)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const res = await createAssetCategoryAction(form)
      if (res.ok) {
        router.push('/patrimonio/categorias')
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>Nome *</label>
          <input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Descrição</label>
          <input className={inputClass} value={form.description} onChange={(e) => update('description', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Vida Útil Padrão (meses) *</label>
          <input type="number" className={inputClass} value={form.defaultUsefulLifeMonths} onChange={(e) => update('defaultUsefulLifeMonths', Number(e.target.value))} required />
        </div>
        <div>
          <label className={labelClass}>Conta do Ativo (padrão)</label>
          <select className={inputClass} value={form.defaultAssetAccountId} onChange={(e) => update('defaultAssetAccountId', e.target.value)}>
            <option value="">— Nenhuma —</option>
            {eligible.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Conta de Depreciação Acumulada (padrão)</label>
          <select className={inputClass} value={form.defaultDepreciationAccountId} onChange={(e) => update('defaultDepreciationAccountId', e.target.value)}>
            <option value="">— Nenhuma —</option>
            {eligible.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Conta de Despesa de Depreciação (padrão)</label>
          <select className={inputClass} value={form.defaultExpenseAccountId} onChange={(e) => update('defaultExpenseAccountId', e.target.value)}>
            <option value="">— Nenhuma —</option>
            {eligible.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Conta de Ganho na Baixa</label>
          <select className={inputClass} value={form.disposalGainAccountId} onChange={(e) => update('disposalGainAccountId', e.target.value)}>
            <option value="">— Nenhuma —</option>
            {eligible.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Conta de Perda na Baixa</label>
          <select className={inputClass} value={form.disposalLossAccountId} onChange={(e) => update('disposalLossAccountId', e.target.value)}>
            <option value="">— Nenhuma —</option>
            {eligible.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={() => router.push('/patrimonio/categorias')} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer">Cancelar</button>
        <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer">
          <Save className="w-4 h-4" />
          {isPending ? 'Salvando...' : 'Criar Categoria'}
        </button>
      </div>
    </form>
  )
}
