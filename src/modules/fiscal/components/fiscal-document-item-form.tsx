'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiscalDocument, FiscalDocumentItem } from '../types'
import { createFiscalDocumentItemAction, deleteFiscalDocumentItemAction } from '../actions'
import { formatCurrencyBRL } from '../utils'
import { AlertCircle, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'

interface FiscalDocumentItemFormProps {
  doc: FiscalDocument
  editable: boolean
}

const inputClass = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500'

export function FiscalDocumentItemForm({ doc, editable }: FiscalDocumentItemFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [form, setForm] = useState({
    description: '',
    itemType: 'PRODUCT' as 'PRODUCT' | 'SERVICE' | 'FREIGHT' | 'ASSET' | 'OTHER',
    quantity: 1,
    unit: 'UN',
    unitPrice: 0,
    totalAmount: 0,
    ncm: '',
    cfop: '',
    icmsAmount: undefined as number | undefined,
    pisAmount: undefined as number | undefined,
    cofinsAmount: undefined as number | undefined,
    issAmount: undefined as number | undefined
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const res = await createFiscalDocumentItemAction({ fiscalDocumentId: doc.id, ...form })
      if (res.ok) {
        setForm({ description: '', itemType: 'PRODUCT', quantity: 1, unit: 'UN', unitPrice: 0, totalAmount: 0, ncm: '', cfop: '', icmsAmount: undefined, pisAmount: undefined, cofinsAmount: undefined, issAmount: undefined })
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  function handleDelete(itemId: string) {
    if (!window.confirm('Remover este item?')) return
    startTransition(async () => {
      await deleteFiscalDocumentItemAction({ id: itemId, fiscalDocumentId: doc.id })
      router.refresh()
    })
  }

  const items = doc.items || []

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Itens do Documento</h3>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">Nenhum item adicionado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-400 uppercase text-[10px] border-b border-gray-100">
              <tr>
                <th className="text-left py-2">Descrição</th>
                <th className="text-left py-2">Produto</th>
                <th className="text-right py-2">Qtd</th>
                <th className="text-right py-2">Vl. Unit.</th>
                <th className="text-right py-2">Total</th>
                <th className="text-right py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item: FiscalDocumentItem) => (
                <tr key={item.id}>
                  <td className="py-2 text-gray-700">{item.description}</td>
                  <td className="py-2">
                    {item.item_id ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Vinculado
                      </span>
                    ) : (
                      <Link
                        href="/fiscal/revisao-itens"
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Sem produto — revisar
                      </Link>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono">{item.quantity}</td>
                  <td className="py-2 text-right font-mono">{formatCurrencyBRL(item.unit_amount)}</td>
                  <td className="py-2 text-right font-mono font-semibold">{formatCurrencyBRL(item.total_amount)}</td>
                  <td className="py-2 text-right">
                    {editable && (
                      <button onClick={() => handleDelete(item.id)} disabled={isPending} className="text-red-500 hover:text-red-700 cursor-pointer disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editable && (
        <form onSubmit={handleAdd} className="border-t border-gray-100 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <div className="col-span-2 sm:col-span-2">
            <label className="text-[10px] text-gray-400 block mb-1">Descrição</label>
            <input className={inputClass} value={form.description} onChange={(e) => update('description', e.target.value)} required />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Tipo</label>
            <select className={inputClass} value={form.itemType} onChange={(e) => update('itemType', e.target.value as any)}>
              <option value="PRODUCT">Produto</option>
              <option value="SERVICE">Serviço</option>
              <option value="FREIGHT">Frete</option>
              <option value="ASSET">Ativo Imobilizado</option>
              <option value="OTHER">Outro</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Unidade</label>
            <input className={inputClass} value={form.unit} onChange={(e) => update('unit', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Quantidade</label>
            <input type="number" step="0.0001" className={inputClass} value={form.quantity} onChange={(e) => update('quantity', Number(e.target.value))} required />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Valor Unit.</label>
            <input type="number" step="0.01" className={inputClass} value={form.unitPrice} onChange={(e) => update('unitPrice', Number(e.target.value))} />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Total do Item *</label>
            <input type="number" step="0.01" className={inputClass} value={form.totalAmount} onChange={(e) => update('totalAmount', Number(e.target.value))} required />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">NCM</label>
            <input className={inputClass} value={form.ncm} onChange={(e) => update('ncm', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">CFOP</label>
            <input className={inputClass} value={form.cfop} onChange={(e) => update('cfop', e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <button type="submit" disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              Adicionar Item
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
