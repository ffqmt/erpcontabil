import React from 'react'
import { FiscalDocument } from '../types'
import { formatCurrencyBRL } from '../utils'
import { Percent } from 'lucide-react'

export function FiscalTaxSummary({ doc }: { doc: FiscalDocument }) {
  const rows: { label: string; base: any; rate: any; amount: any }[] = [
    { label: 'ICMS', base: doc.icms_base, rate: doc.icms_rate, amount: doc.icms_amount },
    { label: 'ISS', base: doc.iss_base, rate: doc.iss_rate, amount: doc.iss_amount },
    { label: 'PIS', base: doc.pis_base, rate: doc.pis_rate, amount: doc.pis_amount },
    { label: 'COFINS', base: doc.cofins_base, rate: doc.cofins_rate, amount: doc.cofins_amount }
  ].filter((r) => r.amount !== null && r.amount !== undefined && Number(r.amount) > 0)

  const retentions = doc.retentions || []

  if (rows.length === 0 && retentions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 text-xs text-gray-400 flex items-center gap-2">
        <Percent className="w-4 h-4 text-gray-300" />
        Nenhum tributo destacado ou retido neste documento.
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
        <Percent className="w-4 h-4 text-gray-400" />
        Tributos
      </h3>

      {rows.length > 0 && (
        <div>
          <span className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Destacados no Documento</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {rows.map((r) => (
              <div key={r.label} className="border border-gray-100 rounded-lg p-2.5">
                <span className="text-[10px] text-gray-400 block">{r.label}{r.rate ? ` (${Number(r.rate).toFixed(2)}%)` : ''}</span>
                <span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {retentions.length > 0 && (
        <div>
          <span className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Retenções na Fonte</span>
          <div className="space-y-1.5">
            {retentions.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs border border-gray-100 rounded-lg p-2.5">
                <span className="text-gray-600">{r.tax_type}{r.rate ? ` (${Number(r.rate).toFixed(2)}%)` : ''} — base {formatCurrencyBRL(r.base_amount)}</span>
                <span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
