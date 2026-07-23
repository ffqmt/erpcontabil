'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Item, FISCAL_ITEM_USAGE_LABELS, FiscalItemUsage } from '../types'
import { createItemAction, updateItemAction } from '../actions'
import { FiscalOperationNature } from '@/modules/registrations/fiscal-natures/types'
import { AlertCircle, Save } from 'lucide-react'

interface ItemFormProps {
  item?: Item
  fiscalNatures: FiscalOperationNature[]
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

export function ItemForm({ item, fiscalNatures }: ItemFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [form, setForm] = useState({
    code: item?.code || '',
    name: item?.name || '',
    description: item?.description || '',
    itemType: (item?.item_type || 'SERVICE') as 'PRODUCT' | 'SERVICE' | 'BOTH',
    unit: item?.unit || '',
    ncm: item?.ncm || '',
    serviceCode: item?.service_code || '',
    cest: item?.cest || '',
    gtin: item?.gtin || '',
    defaultFiscalOperationNatureId: item?.default_fiscal_operation_nature_id || '',
    fiscalItemUsage: (item?.fiscal_item_usage || '') as FiscalItemUsage | ''
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})

    startTransition(async () => {
      const res = item
        ? await updateItemAction({ id: item.id, ...form })
        : await createItemAction(form)

      if (res.ok) {
        router.push('/cadastros/itens')
        router.refresh()
      } else {
        setErrorMsg(res.error)
        setFieldErrors(res.fieldErrors || {})
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
            <label className={labelClass}>Código *</label>
            <input className={inputClass} value={form.code} onChange={(e) => update('code', e.target.value)} required />
            {fieldErrors.code && <p className="text-xs text-red-600 mt-1">{fieldErrors.code[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Classificação *</label>
            <select className={inputClass} value={form.itemType} onChange={(e) => update('itemType', e.target.value as 'PRODUCT' | 'SERVICE' | 'BOTH')}>
              <option value="SERVICE">Serviço</option>
              <option value="PRODUCT">Produto</option>
              <option value="BOTH">Produto e Serviço</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome *</label>
            <input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} required />
            {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name[0]}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Descrição</label>
            <textarea className={inputClass} rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Unidade (ex: UN, KG, H)</label>
            <input className={inputClass} value={form.unit} onChange={(e) => update('unit', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>NCM (produto)</label>
            <input className={inputClass} value={form.ncm} onChange={(e) => update('ncm', e.target.value)} placeholder="Somente cadastral — sem cálculo de tributo" />
          </div>
          <div>
            <label className={labelClass}>Código de Serviço (LC 116)</label>
            <input className={inputClass} value={form.serviceCode} onChange={(e) => update('serviceCode', e.target.value)} placeholder="Somente cadastral" />
          </div>
          <div>
            <label className={labelClass}>CEST</label>
            <input className={inputClass} value={form.cest} onChange={(e) => update('cest', e.target.value)} placeholder="Somente cadastral" />
          </div>
          <div>
            <label className={labelClass}>GTIN/EAN</label>
            <input className={inputClass} value={form.gtin} onChange={(e) => update('gtin', e.target.value)} placeholder="Código de barras, se houver" />
          </div>
          <div>
            <label className={labelClass}>Natureza Fiscal Padrão</label>
            <select className={inputClass} value={form.defaultFiscalOperationNatureId} onChange={(e) => update('defaultFiscalOperationNatureId', e.target.value)}>
              <option value="">— Nenhuma —</option>
              {fiscalNatures.map((n) => (
                <option key={n.id} value={n.id}>{n.code} — {n.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Uso Fiscal</label>
            <select className={inputClass} value={form.fiscalItemUsage} onChange={(e) => update('fiscalItemUsage', e.target.value as FiscalItemUsage | '')}>
              <option value="">— Não classificado —</option>
              {Object.entries(FISCAL_ITEM_USAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/cadastros/itens')}
          className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Salvando...' : item ? 'Salvar Alterações' : 'Criar Item'}
        </button>
      </div>
    </form>
  )
}
