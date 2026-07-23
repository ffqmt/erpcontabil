'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Save, Percent } from 'lucide-react'
import { upsertPisCofinsRecoverySettingsAction } from '../actions'
import { PisCofinsRecoverySettings } from '../types'

interface PisCofinsRecoveryPanelProps {
  settings: PisCofinsRecoverySettings | null
  taxRegime: string
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'

export function PisCofinsRecoveryPanel({ settings, taxRegime }: PisCofinsRecoveryPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(settings?.enabled ?? false)
  const [pisRate, setPisRate] = useState(settings ? Number(settings.pis_rate) * 100 : 0)
  const [cofinsRate, setCofinsRate] = useState(settings ? Number(settings.cofins_rate) * 100 : 0)
  const [notes, setNotes] = useState(settings?.notes || '')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const isLucroReal = taxRegime === 'LUCRO_REAL'

  function handleSave() {
    setErrorMsg(null)
    setSuccessMsg(null)
    if (enabled && (pisRate <= 0 || cofinsRate <= 0)) {
      setErrorMsg('Informe alíquotas positivas de PIS e COFINS antes de habilitar o recálculo automático.')
      return
    }
    startTransition(async () => {
      const res = await upsertPisCofinsRecoverySettingsAction({
        enabled,
        pisRate: pisRate / 100,
        cofinsRate: cofinsRate / 100,
        notes
      })
      if (res.ok) {
        setSuccessMsg(res.message || 'Configuração salva.')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">Crédito de PIS/COFINS na importação de XML</h3>
            <p className="text-xs text-gray-500">
              Sem esta configuração, o XML de entrada é importado com os valores como vieram, sem recalcular — nunca com alíquota adivinhada.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {(errorMsg || successMsg) && (
        <div className="px-5 pt-4">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      )}

      {!isLucroReal && (
        <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs font-semibold">
          Esta empresa não está no regime Lucro Real — mesmo que habilitado aqui, o crédito não-cumulativo de PIS/COFINS não é aplicado automaticamente na importação de XML para outros regimes.
        </div>
      )}

      <div className="p-5 space-y-4">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Recalcular PIS/COFINS recuperável automaticamente na entrada de NF-e (Lucro Real)
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Alíquota PIS (%)</label>
            <input type="number" step="0.01" min="0" max="100" className={inputClass} value={pisRate} onChange={(e) => setPisRate(Number(e.target.value))} disabled={!enabled} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Alíquota COFINS (%)</label>
            <input type="number" step="0.01" min="0" max="100" className={inputClass} value={cofinsRate} onChange={(e) => setCofinsRate(Number(e.target.value))} disabled={!enabled} />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Observações (opcional)</label>
          <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} disabled={!enabled} />
        </div>
      </div>
    </section>
  )
}
