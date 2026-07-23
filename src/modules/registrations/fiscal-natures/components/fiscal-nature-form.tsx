'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FiscalOperationNature, ExpectedRetentionType, FiscalDocumentTypeCode } from '../types'
import { createFiscalNatureAction, updateFiscalNatureAction } from '../actions'
import {
  OPERATION_KIND_LABELS,
  FISCAL_PURPOSE_LABELS,
  ICMS_TREATMENT_LABELS,
  ICMS_ST_TREATMENT_LABELS,
  IPI_TREATMENT_LABELS,
  PIS_COFINS_TREATMENT_LABELS,
  ISS_TREATMENT_LABELS,
  EXPECTED_RETENTION_LABELS,
  ITEM_NATURE_DEFAULT_LABELS,
  FISCAL_DOCUMENT_TYPE_CODE_LABELS
} from '../labels'
import { AlertCircle, Save } from 'lucide-react'

interface FiscalNatureFormProps {
  fiscalNature?: FiscalOperationNature
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'
const checkboxRowClass = 'flex items-center gap-2 text-xs text-gray-700'

function selectOptions<T extends string>(labels: Record<T, string>) {
  return Object.entries(labels) as [T, string][]
}

export function FiscalNatureForm({ fiscalNature }: FiscalNatureFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [form, setForm] = useState({
    code: fiscalNature?.code || '',
    name: fiscalNature?.name || '',
    direction: (fiscalNature?.direction || 'OUTBOUND') as 'INBOUND' | 'OUTBOUND' | 'BOTH',
    description: fiscalNature?.description || '',
    operationKind: fiscalNature?.operation_kind || '',
    applicableDocumentTypes: fiscalNature?.applicable_document_types || ([] as FiscalDocumentTypeCode[]),
    fiscalPurpose: fiscalNature?.fiscal_purpose || '',
    defaultBookkeepingCfop: fiscalNature?.default_bookkeeping_cfop || '',
    defaultTaxSituation: fiscalNature?.default_tax_situation || '',
    icmsTreatment: fiscalNature?.icms_treatment || '',
    icmsStTreatment: fiscalNature?.icms_st_treatment || '',
    difalApplicable: fiscalNature?.difal_applicable ?? false,
    ipiTreatment: fiscalNature?.ipi_treatment || '',
    pisCofinsTreatment: fiscalNature?.pis_cofins_treatment || '',
    issTreatment: fiscalNature?.iss_treatment || '',
    expectedRetentions: fiscalNature?.expected_retentions || ([] as ExpectedRetentionType[]),
    generatesCredit: fiscalNature?.generates_credit ?? false,
    entersTaxAssessment: fiscalNature?.enters_tax_assessment ?? true,
    triggersAccounting: fiscalNature?.triggers_accounting ?? true,
    requiresProduct: fiscalNature?.requires_product ?? false,
    requiresNcm: fiscalNature?.requires_ncm ?? false,
    itemNatureDefault: fiscalNature?.item_nature_default || ''
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleInArray<T extends string>(key: 'applicableDocumentTypes' | 'expectedRetentions', value: T) {
    setForm((prev) => {
      const current = prev[key] as T[]
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})

    startTransition(async () => {
      const res = fiscalNature
        ? await updateFiscalNatureAction({ id: fiscalNature.id, ...form })
        : await createFiscalNatureAction(form)

      if (res.ok) {
        router.push('/cadastros/naturezas-fiscais')
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
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Identificação</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Código *</label>
            <input className={inputClass} value={form.code} onChange={(e) => update('code', e.target.value)} required />
            {fieldErrors.code && <p className="text-xs text-red-600 mt-1">{fieldErrors.code[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Direção *</label>
            <select className={inputClass} value={form.direction} onChange={(e) => update('direction', e.target.value as 'INBOUND' | 'OUTBOUND' | 'BOTH')}>
              <option value="OUTBOUND">Saída</option>
              <option value="INBOUND">Entrada</option>
              <option value="BOTH">Ambas</option>
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
          <div className="sm:col-span-2">
            <label className={labelClass}>Tipos de documento em que esta natureza faz sentido</label>
            <div className="flex flex-wrap gap-3">
              {selectOptions(FISCAL_DOCUMENT_TYPE_CODE_LABELS).map(([value, label]) => (
                <label key={value} className={checkboxRowClass}>
                  <input type="checkbox" checked={form.applicableDocumentTypes.includes(value)} onChange={() => toggleInArray('applicableDocumentTypes', value)} />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Vazio = qualquer tipo de documento.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Motor Operacional (Etapa 35B.1-A)</h3>
        <p className="text-[11px] text-gray-400">
          Estes campos preparam o lançamento/importação: sugerem CFOP de escrituração, CST e tratamento tributário automaticamente quando esta natureza é escolhida. Todos são opcionais — sem preenchimento, o comportamento é o mesmo de antes (sem sugestão).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tipo de Operação</label>
            <select className={inputClass} value={form.operationKind} onChange={(e) => update('operationKind', e.target.value as typeof form.operationKind)}>
              <option value="">— Não definido —</option>
              {selectOptions(OPERATION_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Finalidade Fiscal</label>
            <select className={inputClass} value={form.fiscalPurpose} onChange={(e) => update('fiscalPurpose', e.target.value as typeof form.fiscalPurpose)}>
              <option value="">— Não definido —</option>
              {selectOptions(FISCAL_PURPOSE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>CFOP de Escrituração Sugerido</label>
            <input className={inputClass} value={form.defaultBookkeepingCfop} onChange={(e) => update('defaultBookkeepingCfop', e.target.value)} placeholder="ex.: 1102" maxLength={10} />
          </div>
          <div>
            <label className={labelClass}>CST/CSOSN de ICMS Sugerido</label>
            <input className={inputClass} value={form.defaultTaxSituation} onChange={(e) => update('defaultTaxSituation', e.target.value)} placeholder="ex.: 00 ou 102" maxLength={10} />
          </div>
          <div>
            <label className={labelClass}>Tipo de Item Padrão</label>
            <select className={inputClass} value={form.itemNatureDefault} onChange={(e) => update('itemNatureDefault', e.target.value as typeof form.itemNatureDefault)}>
              <option value="">— Não definido —</option>
              {selectOptions(ITEM_NATURE_DEFAULT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tratamento Tributário (sinalização — sem cálculo automático)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>ICMS</label>
            <select className={inputClass} value={form.icmsTreatment} onChange={(e) => update('icmsTreatment', e.target.value as typeof form.icmsTreatment)}>
              <option value="">— Não definido —</option>
              {selectOptions(ICMS_TREATMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>ICMS-ST</label>
            <select className={inputClass} value={form.icmsStTreatment} onChange={(e) => update('icmsStTreatment', e.target.value as typeof form.icmsStTreatment)}>
              <option value="">— Não definido —</option>
              {selectOptions(ICMS_ST_TREATMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>IPI</label>
            <select className={inputClass} value={form.ipiTreatment} onChange={(e) => update('ipiTreatment', e.target.value as typeof form.ipiTreatment)}>
              <option value="">— Não definido —</option>
              {selectOptions(IPI_TREATMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>PIS/COFINS</label>
            <select className={inputClass} value={form.pisCofinsTreatment} onChange={(e) => update('pisCofinsTreatment', e.target.value as typeof form.pisCofinsTreatment)}>
              <option value="">— Não definido —</option>
              {selectOptions(PIS_COFINS_TREATMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>ISS</label>
            <select className={inputClass} value={form.issTreatment} onChange={(e) => update('issTreatment', e.target.value as typeof form.issTreatment)}>
              <option value="">— Não definido —</option>
              {selectOptions(ISS_TREATMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Retenções Esperadas</label>
          <div className="flex flex-wrap gap-3">
            {selectOptions(EXPECTED_RETENTION_LABELS).map(([value, label]) => (
              <label key={value} className={checkboxRowClass}>
                <input type="checkbox" checked={form.expectedRetentions.includes(value)} onChange={() => toggleInArray('expectedRetentions', value)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-100">
          <label className={checkboxRowClass}>
            <input type="checkbox" checked={form.difalApplicable} onChange={(e) => update('difalApplicable', e.target.checked)} />
            Pode gerar DIFAL
          </label>
          <label className={checkboxRowClass}>
            <input type="checkbox" checked={form.generatesCredit} onChange={(e) => update('generatesCredit', e.target.checked)} />
            Gera crédito (entrada)
          </label>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Comportamento Operacional</h3>
        <div className="flex flex-wrap gap-4">
          <label className={checkboxRowClass}>
            <input type="checkbox" checked={form.entersTaxAssessment} onChange={(e) => update('entersTaxAssessment', e.target.checked)} />
            Entra na apuração tributária
          </label>
          <label className={checkboxRowClass}>
            <input type="checkbox" checked={form.triggersAccounting} onChange={(e) => update('triggersAccounting', e.target.checked)} />
            Gera contabilização
          </label>
          <label className={checkboxRowClass}>
            <input type="checkbox" checked={form.requiresProduct} onChange={(e) => update('requiresProduct', e.target.checked)} />
            Exige produto vinculado
          </label>
          <label className={checkboxRowClass}>
            <input type="checkbox" checked={form.requiresNcm} onChange={(e) => update('requiresNcm', e.target.checked)} />
            Exige NCM
          </label>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
          Cadastro estrutural — sem cálculo de imposto completo. Consumido pelas Regras de Importação XML, pela importação de XML e pela apuração tributária (Etapa 35B.1-A).
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/cadastros/naturezas-fiscais')}
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
          {isPending ? 'Salvando...' : fiscalNature ? 'Salvar Alterações' : 'Criar Natureza Fiscal'}
        </button>
      </div>
    </form>
  )
}
