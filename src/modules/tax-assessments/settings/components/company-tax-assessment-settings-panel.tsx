'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Save, Settings2, Slash } from 'lucide-react'
import { TAX_REGIME_LABELS, TaxRegime } from '@/modules/registrations/companies/types'
import { updateCompanyTaxAssessmentSettingsAction } from '../actions'
import {
  CompanyTaxAssessmentSetting,
  DOCUMENT_ACCOUNTED_TAX_TYPES,
  getTaxAssessmentOption
} from '../options'

interface CompanyTaxAssessmentSettingsPanelProps {
  taxRegime: TaxRegime
  settings: CompanyTaxAssessmentSetting[]
}

const checkboxClass = 'h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer'

export function CompanyTaxAssessmentSettingsPanel({ taxRegime, settings }: CompanyTaxAssessmentSettingsPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState(settings)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  function updateRow(taxType: string, patch: Partial<CompanyTaxAssessmentSetting>) {
    setRows((prev) => prev.map((row) => (row.tax_type === taxType ? { ...row, ...patch } : row)))
  }

  function handleSave() {
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await updateCompanyTaxAssessmentSettingsAction({
        settings: rows.map((row) => ({
          taxType: row.tax_type,
          enabled: row.enabled,
          accountAssessment: row.account_assessment,
          calculationMode: row.calculation_mode
        }))
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
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">Tributos apurados pela empresa</h3>
            <p className="text-xs text-gray-500">Regime atual: {TAX_REGIME_LABELS[taxRegime]}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Salvando...' : 'Salvar Seleção'}
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

      <div className="divide-y divide-gray-100">
        {rows.map((row) => {
          const option = getTaxAssessmentOption(row.tax_type)
          return (
            <div key={row.tax_type} className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
              <label className="flex items-start gap-3 cursor-pointer min-w-0">
                <input
                  type="checkbox"
                  className={`${checkboxClass} mt-1`}
                  checked={row.enabled}
                  onChange={(e) => updateRow(row.tax_type, { enabled: e.target.checked })}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-gray-800">{option.label}</span>
                  <span className="block text-xs text-gray-500">{option.description}</span>
                </span>
              </label>
              <div className="flex items-center gap-4 pl-7 md:pl-0">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={row.account_assessment}
                    onChange={(e) => updateRow(row.tax_type, { account_assessment: e.target.checked })}
                    disabled={!row.enabled}
                  />
                  Contabilizar apuração
                </label>
                <select
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={row.calculation_mode}
                  onChange={(e) => updateRow(row.tax_type, { calculation_mode: e.target.value === 'MANUAL' ? 'MANUAL' : 'AUTO' })}
                  disabled={!row.enabled}
                >
                  <option value="AUTO">Automático</option>
                  <option value="MANUAL">Manual/Retenções</option>
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-500">
        <Slash className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <span>PIS e COFINS ficam fora da apuração fiscal porque são contabilizados diretamente pelas regras contábeis do documento fiscal.</span>
        <span className="sr-only">{DOCUMENT_ACCOUNTED_TAX_TYPES.join(', ')}</span>
      </div>
    </section>
  )
}
