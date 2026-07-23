'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTaxAssessmentAction, batchCreateTaxAssessmentsAction, BatchAssessmentResultItem } from '../actions'
import { TaxAssessmentOption, CompanyTaxAssessmentSetting } from '../settings/options'
import { AlertCircle, Save, CheckCircle2, Sliders, Layers, Sparkles, AlertTriangle } from 'lucide-react'

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

interface TaxAssessmentFormProps {
  defaultCompetence?: string
  taxOptions: TaxAssessmentOption[]
  assessmentSettings?: CompanyTaxAssessmentSetting[]
}

function monthValueFromCompetence(competence: string | undefined) {
  return competence ? competence.substring(0, 7) : ''
}

function competenceFromMonth(monthValue: string) {
  return monthValue ? `${monthValue}-01` : ''
}

export function TaxAssessmentForm({ defaultCompetence, taxOptions, assessmentSettings = [] }: TaxAssessmentFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<'BATCH' | 'SINGLE'>('BATCH')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [batchResults, setBatchResults] = useState<BatchAssessmentResultItem[] | null>(null)

  const [taxType, setTaxType] = useState<string>(taxOptions[0]?.value || '')
  const [competenceMonth, setCompetenceMonth] = useState(monthValueFromCompetence(defaultCompetence))
  const [dueDate, setDueDate] = useState('')

  const enabledSettings = assessmentSettings.filter((s) => s.enabled)
  const autoSettings = enabledSettings.filter((s) => s.calculation_mode === 'AUTO')
  const manualSettings = enabledSettings.filter((s) => s.calculation_mode === 'MANUAL')
  const hasTaxOptions = taxOptions.length > 0

  function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasTaxOptions || !taxType) {
      setErrorMsg('Nenhum tributo habilitado para apuração nesta empresa. Ajuste em Fiscal > Configurações Tributárias.')
      return
    }
    setErrorMsg(null)
    setSuccessMsg(null)
    setBatchResults(null)
    startTransition(async () => {
      const res = await createTaxAssessmentAction({ taxType, competence: competenceFromMonth(competenceMonth), dueDate })
      if (res.ok) {
        router.push(`/fiscal/apuracoes/${res.data.id}`)
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  function handleBatchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!competenceMonth) {
      setErrorMsg('Informe a competência (AAAA-MM) para a apuração.')
      return
    }
    if (enabledSettings.length === 0) {
      setErrorMsg('Nenhum tributo está habilitado para apuração nesta empresa.')
      return
    }
    setErrorMsg(null)
    setSuccessMsg(null)
    setBatchResults(null)

    startTransition(async () => {
      const res = await batchCreateTaxAssessmentsAction({ competence: competenceFromMonth(competenceMonth), dueDate })
      if (res.ok) {
        setBatchResults(res.data.items)
        setSuccessMsg(res.message || 'Apuração da competência concluída!')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
      {/* Seletor de Modo */}
      <div className="flex border-b border-gray-200 pb-3 gap-4">
        <button
          type="button"
          onClick={() => setMode('BATCH')}
          className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            mode === 'BATCH'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          Apurar Competência Completa (Domínio ERP)
        </button>
        <button
          type="button"
          onClick={() => setMode('SINGLE')}
          className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            mode === 'SINGLE'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Apurar Tributo Específico
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-semibold flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Atenção</p>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl text-xs font-semibold flex gap-3 items-start">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Sucesso</p>
            <p className="mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {mode === 'BATCH' ? (
        <form onSubmit={handleBatchSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Competência Operacional *</label>
              <input
                type="month"
                className={inputClass}
                value={competenceMonth}
                onChange={(e) => setCompetenceMonth(e.target.value)}
                required
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Competência de apuração dos documentos fiscais escriturados.
              </p>
            </div>
            <div>
              <label className={labelClass}>Vencimento Padrão (Opcional)</label>
              <input
                type="date"
                className={inputClass}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Data de vencimento a atribuir às apurações criadas.
              </p>
            </div>
          </div>

          {/* Preview dos Tributos Habilitados */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Tributos Habilitados nos Parâmetros Fiscais ({enabledSettings.length})
              </span>
              <button
                type="button"
                onClick={() => router.push('/fiscal/configuracoes-tributarias')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                Ajustar Parâmetros Fiscais &rarr;
              </button>
            </div>

            {enabledSettings.length === 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                Nenhum tributo está habilitado para apuração nesta empresa. Acesse as Configurações Tributárias para ativar os tributos desejados.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {enabledSettings.map((s) => (
                  <div
                    key={s.tax_type}
                    className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg text-xs"
                  >
                    <span className="font-bold text-gray-800">{s.tax_type}</span>
                    {s.calculation_mode === 'AUTO' ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold text-[11px] rounded-md">
                        Cálculo Automático (AUTO)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-semibold text-[11px] rounded-md">
                        Lançamento Manual (MANUAL)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resultado do Batch */}
          {batchResults && (
            <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
              <h4 className="font-bold text-sm text-gray-800 border-b pb-2">
                Resumo da Apuração ({competenceMonth})
              </h4>
              <div className="space-y-2">
                {batchResults.map((item) => (
                  <div
                    key={item.taxType}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 text-xs gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-800">{item.taxType}</span>
                      <span className="text-gray-500">• {item.message}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {typeof item.payableAmount === 'number' && (
                        <span className="font-mono font-bold text-sm text-emerald-700">
                          R$ {item.payableAmount.toFixed(2)}
                        </span>
                      )}
                      {item.assessmentId && (
                        <button
                          type="button"
                          onClick={() => router.push(`/fiscal/apuracoes/${item.assessmentId}`)}
                          className="px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-100 font-semibold text-gray-700 rounded transition-all"
                        >
                          Ver Detalhes &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => router.push('/fiscal/apuracoes')}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || enabledSettings.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isPending ? 'Gerando...' : 'Gerar Apurações da Competência'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSingleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Tributo *</label>
              <select
                className={inputClass}
                value={taxType}
                onChange={(e) => setTaxType(e.target.value)}
                disabled={!hasTaxOptions}
              >
                {taxOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Competência *</label>
              <input
                type="month"
                className={inputClass}
                value={competenceMonth}
                onChange={(e) => setCompetenceMonth(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Vencimento</label>
              <input
                type="date"
                className={inputClass}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => router.push('/fiscal/apuracoes')}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !hasTaxOptions}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isPending ? 'Criando...' : 'Criar e Calcular'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
