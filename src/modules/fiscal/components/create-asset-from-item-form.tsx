'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createFixedAssetFromFiscalItemAction } from '@/modules/assets/actions'
import { AssetCategory } from '@/modules/assets/types'
import { formatCurrencyBRL } from '../utils'
import { AlertCircle, Boxes } from 'lucide-react'

interface AssetPendingItem {
  id: string
  description: string
  total_amount: number | string
}

interface CreateAssetFromItemFormProps {
  item: AssetPendingItem
  categories: AssetCategory[]
}

const inputClass = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500'

export function CreateAssetFromItemForm({ item, categories }: CreateAssetFromItemFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [usefulLifeMonths, setUsefulLifeMonths] = useState<number | ''>('')
  const [residualAmount, setResidualAmount] = useState<number | ''>('')

  const activeCategories = categories.filter((c) => c.active)
  const selectedCategory = activeCategories.find((c) => c.id === categoryId)
  const categoryMissingAccounts =
    selectedCategory && (!selectedCategory.default_asset_account_id || !selectedCategory.default_depreciation_account_id || !selectedCategory.default_expense_account_id)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const res = await createFixedAssetFromFiscalItemAction({
        fiscalDocumentItemId: item.id,
        categoryId,
        usefulLifeMonths: usefulLifeMonths === '' ? undefined : usefulLifeMonths,
        residualAmount: residualAmount === '' ? undefined : residualAmount
      })
      if (res.ok) {
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-gray-700 flex items-center gap-1.5">
          <Boxes className="w-3.5 h-3.5 text-gray-400" />
          {item.description}
        </span>
        <span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(item.total_amount)}</span>
      </div>
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-[11px] flex gap-1.5 items-start">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-1">
          <label className="text-[10px] text-gray-400 block mb-0.5">Categoria *</label>
          <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">— Selecione —</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Vida Útil (meses)</label>
          <input
            type="number"
            className={inputClass}
            value={usefulLifeMonths}
            placeholder={selectedCategory ? String(selectedCategory.default_useful_life_months) : ''}
            onChange={(e) => setUsefulLifeMonths(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Valor Residual</label>
          <input
            type="number"
            step="0.01"
            className={inputClass}
            value={residualAmount}
            placeholder="0,00"
            onChange={(e) => setResidualAmount(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
      </div>
      {categoryMissingAccounts && (
        <p className="text-[11px] text-amber-700">Esta categoria não tem as 3 contas contábeis configuradas — configure em Patrimônio &gt; Categorias antes de criar o bem.</p>
      )}
      <button
        type="submit"
        disabled={isPending || !categoryId || !!categoryMissingAccounts}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
      >
        {isPending ? 'Criando...' : 'Criar Bem Patrimonial'}
      </button>
    </form>
  )
}
