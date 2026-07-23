'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AssetCategory, FixedAsset } from '../types'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { Partner } from '@/modules/registrations/partners/types'
import { createFixedAssetAction, updateFixedAssetAction } from '../actions'
import { AlertCircle, Save } from 'lucide-react'

interface FixedAssetFormProps {
  asset?: FixedAsset
  categories: AssetCategory[]
  chartAccounts: ChartAccount[]
  partners: Partner[]
  costCenters: { id: string; code: string; name: string }[]
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

export function FixedAssetForm({ asset, categories, chartAccounts, partners, costCenters }: FixedAssetFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    categoryId: asset?.category_id || '',
    code: asset?.code || '',
    description: asset?.description || '',
    assetTag: asset?.asset_tag || '',
    acquisitionDate: asset?.acquisition_date || '',
    startDepreciationDate: asset?.start_depreciation_date || '',
    acquisitionAmount: asset ? Number(asset.acquisition_amount) : 0,
    residualAmount: asset ? Number(asset.residual_amount) : 0,
    usefulLifeMonths: asset?.useful_life_months || 60,
    partnerId: asset?.partner_id || '',
    assetAccountId: asset?.asset_account_id || '',
    depreciationAccountId: asset?.depreciation_account_id || '',
    expenseAccountId: asset?.expense_account_id || '',
    costCenterId: asset?.cost_center_id || ''
  })

  const eligible = chartAccounts.filter((a) => a.accepts_entries && !a.is_synthetic && a.is_active)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function applyCategoryDefaults(categoryId: string) {
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat) return
    setForm((prev) => ({
      ...prev,
      categoryId,
      usefulLifeMonths: cat.default_useful_life_months || prev.usefulLifeMonths,
      assetAccountId: cat.default_asset_account_id || prev.assetAccountId,
      depreciationAccountId: cat.default_depreciation_account_id || prev.depreciationAccountId,
      expenseAccountId: cat.default_expense_account_id || prev.expenseAccountId
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const res = asset ? await updateFixedAssetAction({ id: asset.id, ...form }) : await createFixedAssetAction(form)
      if (res.ok) {
        router.push(asset ? `/patrimonio/bens/${asset.id}` : '/patrimonio/bens')
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
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Identificação</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Categoria *</label>
            <select className={inputClass} value={form.categoryId} onChange={(e) => applyCategoryDefaults(e.target.value)} required>
              <option value="">— Selecione —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Descrição *</label>
            <input className={inputClass} value={form.description} onChange={(e) => update('description', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Código</label>
            <input className={inputClass} value={form.code} onChange={(e) => update('code', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Etiqueta Patrimonial</label>
            <input className={inputClass} value={form.assetTag} onChange={(e) => update('assetTag', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Fornecedor</label>
            <select className={inputClass} value={form.partnerId} onChange={(e) => update('partnerId', e.target.value)}>
              <option value="">— Nenhum —</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Aquisição e Depreciação</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Data de Aquisição *</label>
            <input type="date" className={inputClass} value={form.acquisitionDate} onChange={(e) => update('acquisitionDate', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Início da Depreciação</label>
            <input type="date" className={inputClass} value={form.startDepreciationDate} onChange={(e) => update('startDepreciationDate', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Vida Útil (meses) *</label>
            <input type="number" className={inputClass} value={form.usefulLifeMonths} onChange={(e) => update('usefulLifeMonths', Number(e.target.value))} required />
          </div>
          <div>
            <label className={labelClass}>Valor de Aquisição *</label>
            <input type="number" step="0.01" className={inputClass} value={form.acquisitionAmount} onChange={(e) => update('acquisitionAmount', Number(e.target.value))} required />
          </div>
          <div>
            <label className={labelClass}>Valor Residual</label>
            <input type="number" step="0.01" className={inputClass} value={form.residualAmount} onChange={(e) => update('residualAmount', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>Centro de Custo</label>
            <select className={inputClass} value={form.costCenterId} onChange={(e) => update('costCenterId', e.target.value)}>
              <option value="">— Nenhum —</option>
              {costCenters.map((cc) => <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contas Contábeis *</h3>
        <p className="text-[11px] text-gray-400">Preenchidas automaticamente com o padrão da categoria — ajuste se este bem específico usar contas diferentes.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Conta do Ativo *</label>
            <select className={inputClass} value={form.assetAccountId} onChange={(e) => update('assetAccountId', e.target.value)} required>
              <option value="">— Selecione —</option>
              {eligible.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Conta de Depreciação Acumulada *</label>
            <select className={inputClass} value={form.depreciationAccountId} onChange={(e) => update('depreciationAccountId', e.target.value)} required>
              <option value="">— Selecione —</option>
              {eligible.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Conta de Despesa de Depreciação *</label>
            <select className={inputClass} value={form.expenseAccountId} onChange={(e) => update('expenseAccountId', e.target.value)} required>
              <option value="">— Selecione —</option>
              {eligible.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push('/patrimonio/bens')} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer">Cancelar</button>
        <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer">
          <Save className="w-4 h-4" />
          {isPending ? 'Salvando...' : asset ? 'Salvar Alterações' : 'Criar Bem Patrimonial'}
        </button>
      </div>
    </form>
  )
}
