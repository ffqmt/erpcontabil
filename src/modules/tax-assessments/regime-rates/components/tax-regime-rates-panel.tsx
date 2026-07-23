'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TaxRegimeRate } from '../types'
import { FiscalOperationNature } from '@/modules/registrations/fiscal-natures/types'
import { createTaxRegimeRateAction, updateTaxRegimeRateAction, toggleTaxRegimeRateActiveAction, deleteTaxRegimeRateAction } from '../actions'
import { AlertCircle, Plus, Power, Trash2, Percent } from 'lucide-react'

interface TaxRegimeRatesPanelProps {
  rates: TaxRegimeRate[]
  fiscalNatures: FiscalOperationNature[]
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

const REGIME_LABELS: Record<string, string> = { SIMPLES_NACIONAL: 'Simples Nacional', LUCRO_PRESUMIDO: 'Lucro Presumido', LUCRO_REAL: 'Lucro Real' }

function pct(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${(Number(v) * 100).toFixed(2)}%`
}

export function TaxRegimeRatesPanel({ rates, fiscalNatures }: TaxRegimeRatesPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    taxRegime: 'LUCRO_PRESUMIDO' as 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL',
    taxType: 'IRPJ' as 'IRPJ' | 'CSLL' | 'SIMPLES',
    fiscalOperationNatureId: '',
    presumptionRate: undefined as number | undefined,
    taxRate: 0.15,
    additionalRate: undefined as number | undefined,
    additionalThresholdMonthly: undefined as number | undefined,
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: ''
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const res = await createTaxRegimeRateAction(form)
      if (res.ok) {
        setShowForm(false)
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  function handleToggle(rate: TaxRegimeRate) {
    startTransition(async () => {
      await toggleTaxRegimeRateActiveAction({ id: rate.id, active: !rate.active })
      router.refresh()
    })
  }

  function handleDelete(rate: TaxRegimeRate) {
    if (!window.confirm('Excluir esta configuração de alíquota?')) return
    startTransition(async () => {
      const res = await deleteTaxRegimeRateAction({ id: rate.id })
      if (!res.ok) window.alert(res.error)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Configuração
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Regime Tributário *</label>
              <select className={inputClass} value={form.taxRegime} onChange={(e) => update('taxRegime', e.target.value as any)}>
                <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                <option value="LUCRO_REAL">Lucro Real</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Tributo *</label>
              <select className={inputClass} value={form.taxType} onChange={(e) => update('taxType', e.target.value as any)}>
                <option value="IRPJ">IRPJ</option>
                <option value="CSLL">CSLL</option>
                <option value="SIMPLES">Simples (DAS)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Natureza Fiscal (opcional)</label>
              <select className={inputClass} value={form.fiscalOperationNatureId} onChange={(e) => update('fiscalOperationNatureId', e.target.value)}>
                <option value="">— Genérica (empresa toda) —</option>
                {fiscalNatures.map((n) => (
                  <option key={n.id} value={n.id}>{n.code} — {n.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>% de Presunção (só Presumido)</label>
              <input type="number" step="0.0001" className={inputClass} value={form.presumptionRate ?? ''} onChange={(e) => update('presumptionRate', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Ex.: 0.32 = 32%" />
            </div>
            <div>
              <label className={labelClass}>Alíquota do Tributo *</label>
              <input type="number" step="0.0001" className={inputClass} value={form.taxRate} onChange={(e) => update('taxRate', Number(e.target.value))} required placeholder="Ex.: 0.15 = 15%" />
            </div>
            <div>
              <label className={labelClass}>Alíquota Adicional (só IRPJ)</label>
              <input type="number" step="0.0001" className={inputClass} value={form.additionalRate ?? ''} onChange={(e) => update('additionalRate', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Ex.: 0.10 = 10%" />
            </div>
            <div>
              <label className={labelClass}>Limite Mensal do Adicional</label>
              <input type="number" step="0.01" className={inputClass} value={form.additionalThresholdMonthly ?? ''} onChange={(e) => update('additionalThresholdMonthly', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Ex.: 20000.00" />
            </div>
            <div>
              <label className={labelClass}>Vigente a partir de *</label>
              <input type="date" className={inputClass} value={form.validFrom} onChange={(e) => update('validFrom', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Vigente até (opcional)</label>
              <input type="date" className={inputClass} value={form.validUntil} onChange={(e) => update('validUntil', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 cursor-pointer">Cancelar</button>
            <button type="submit" disabled={isPending} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg disabled:opacity-50 cursor-pointer">
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      {rates.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
          <Percent className="w-8 h-8 text-gray-300" />
          <span className="text-sm font-semibold text-gray-600">Nenhuma alíquota configurada</span>
          <p className="text-xs text-gray-400 max-w-sm">Sem configuração, o motor de apuração de IRPJ/CSLL bloqueia o cálculo com erro claro — nunca usa um valor hardcoded.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rates.map((rate) => (
            <div key={rate.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-800">{rate.tax_type}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600">{REGIME_LABELS[rate.tax_regime]}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${rate.active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {rate.active ? 'Ativa' : 'Inativa'}
                  </span>
                  {rate.fiscal_operation_nature && <span className="text-gray-400">Natureza: {rate.fiscal_operation_nature.name}</span>}
                </div>
                <p className="text-gray-500">
                  {rate.presumption_rate !== null && <>Presunção {pct(rate.presumption_rate)} · </>}
                  Alíquota {pct(rate.tax_rate)}
                  {rate.additional_rate !== null && <> · Adicional {pct(rate.additional_rate)} acima de R$ {Number(rate.additional_threshold_monthly ?? 0).toFixed(2)}/mês</>}
                </p>
                <p className="text-gray-400">Vigência: {rate.valid_from} {rate.valid_until ? `até ${rate.valid_until}` : '(sem data final)'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(rate)} disabled={isPending} className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg cursor-pointer ${rate.active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                  <Power className="w-3.5 h-3.5" />
                  {rate.active ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => handleDelete(rate)} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-red-300 hover:text-red-600 text-gray-500 text-xs font-semibold rounded-lg cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
