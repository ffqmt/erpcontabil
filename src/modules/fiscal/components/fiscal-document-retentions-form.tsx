'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FiscalDocument } from '../types'
import { upsertFiscalDocumentRetentionsAction } from '../actions'
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react'

interface FiscalDocumentRetentionsFormProps {
  doc: FiscalDocument
}

type RetentionTaxType = 'ISS' | 'INSS_RETIDO' | 'IRRF' | 'PIS' | 'COFINS' | 'PCC'

interface RetentionRow {
  taxType: RetentionTaxType
  baseAmount: number
  rate: number | ''
  amount: number
  withheldByPartner: boolean
  notes: string
}

const TAX_TYPE_LABELS: Record<RetentionTaxType, string> = {
  ISS: 'ISS Retido',
  INSS_RETIDO: 'INSS Retido',
  IRRF: 'IRRF',
  PIS: 'PIS Retido',
  COFINS: 'COFINS Retido',
  PCC: 'CSLL/PCC Retido'
}

const inputClass = 'w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500'

function toRow(r: NonNullable<FiscalDocument['retentions']>[number]): RetentionRow {
  return {
    taxType: r.tax_type as RetentionTaxType,
    baseAmount: Number(r.base_amount) || 0,
    rate: r.rate === null || r.rate === undefined ? '' : Number(r.rate),
    amount: Number(r.amount) || 0,
    withheldByPartner: r.withheld_by_partner,
    notes: r.notes || ''
  }
}

/**
 * Etapa 35B: upsertFiscalDocumentRetentionsAction já existia (substitui a lista inteira de
 * retenções do documento a cada chamada) mas não tinha formulário — só a exibição somente-
 * leitura em FiscalTaxSummary. Este formulário fecha essa lacuna sem tocar na action.
 */
export function FiscalDocumentRetentionsForm({ doc }: FiscalDocumentRetentionsFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState<RetentionRow[]>((doc.retentions || []).map(toRow))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function updateRow(index: number, patch: Partial<RetentionRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    setSuccess(false)
  }

  function addRow() {
    setRows((prev) => [...prev, { taxType: 'ISS', baseAmount: 0, rate: '', amount: 0, withheldByPartner: true, notes: '' }])
    setSuccess(false)
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
    setSuccess(false)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const res = await upsertFiscalDocumentRetentionsAction({
        fiscalDocumentId: doc.id,
        retentions: rows.map((r) => ({
          taxType: r.taxType,
          baseAmount: r.baseAmount,
          rate: r.rate === '' ? undefined : r.rate,
          amount: r.amount,
          withheldByPartner: r.withheldByPartner,
          notes: r.notes || undefined
        }))
      })
      if (res.ok) {
        setSuccess(true)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Retenções na Fonte (lançamento manual)</h3>
      <p className="text-[11px] text-gray-400">Especialmente relevante para NFS-e: ISS/INSS/IRRF/PIS/COFINS/CSLL retidos pelo tomador. Salvar substitui a lista inteira de retenções deste documento.</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs font-semibold flex gap-2 items-center">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Retenções salvas.
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-400 uppercase text-[10px] border-b border-gray-100">
              <tr>
                <th className="text-left py-1.5">Tributo</th>
                <th className="text-right py-1.5">Base</th>
                <th className="text-right py-1.5">Alíquota %</th>
                <th className="text-right py-1.5">Valor Retido</th>
                <th className="text-left py-1.5">Observações</th>
                <th className="py-1.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="py-1.5 pr-2">
                    <select className={inputClass} value={row.taxType} onChange={(e) => updateRow(index, { taxType: e.target.value as RetentionTaxType })}>
                      {Object.entries(TAX_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" step="0.01" className={inputClass + ' text-right'} value={row.baseAmount} onChange={(e) => updateRow(index, { baseAmount: Number(e.target.value) })} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" step="0.01" className={inputClass + ' text-right'} value={row.rate} onChange={(e) => updateRow(index, { rate: e.target.value === '' ? '' : Number(e.target.value) })} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" step="0.01" className={inputClass + ' text-right'} value={row.amount} onChange={(e) => updateRow(index, { amount: Number(e.target.value) })} required />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input className={inputClass} value={row.notes} onChange={(e) => updateRow(index, { notes: e.target.value })} />
                  </td>
                  <td className="py-1.5">
                    <button type="button" onClick={() => removeRow(index)} className="text-red-500 hover:text-red-700 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={addRow} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
          Adicionar retenção
        </button>
        <button type="submit" disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Salvar retenções
        </button>
      </div>
    </form>
  )
}
