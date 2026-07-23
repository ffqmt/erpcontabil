'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ACCOUNT_SOURCE_LABELS,
  DEBIT_CREDIT_LABELS,
  DebitCredit,
  FiscalAccountingRule,
  AccountSource,
  ValueBase,
  VALUE_BASE_LABELS
} from '../types'
import { normalizedRuleLines } from '../utils'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { FiscalOperationNature } from '@/modules/registrations/fiscal-natures/types'
import { Partner } from '@/modules/registrations/partners/types'
import { createFiscalAccountingRuleAction, updateFiscalAccountingRuleAction } from '../actions'
import { AlertCircle, Plus, Save, Trash2, X } from 'lucide-react'

interface RuleFormProps {
  rule?: FiscalAccountingRule
  chartAccounts: ChartAccount[]
  fiscalNatures: FiscalOperationNature[]
  partners: Partner[]
}

type RuleLineForm = {
  clientId: string
  debitCredit: DebitCredit
  accountSource: AccountSource
  accountId: string
  valueBase: ValueBase
  amountMultiplier: number
  memoTemplate: string
}

type RuleFormState = {
  name: string
  description: string
  priority: number
  documentTypes: string[]
  directions: string[]
  cfops: string[]
  cfopPatterns: string[]
  fiscalOperationNatureIds: string[]
  itemTypes: string[]
  partnerIds: string[]
  taxRegimes: string[]
  minAmount: number | undefined
  maxAmount: number | undefined
  descriptionTemplate: string
  lines: RuleLineForm[]
}

type Option = {
  value: string
  label: string
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'
const valueBaseOptions = Object.entries(VALUE_BASE_LABELS) as [ValueBase, string][]
const accountSourceOptions = Object.entries(ACCOUNT_SOURCE_LABELS) as [AccountSource, string][]
const valueBaseValues = new Set(valueBaseOptions.map(([value]) => value))

const documentTypeOptions: Option[] = [
  { value: 'NFE', label: 'NF-e' },
  { value: 'NFCE', label: 'NFC-e' },
  { value: 'NFSE', label: 'NFS-e' },
  { value: 'CTE', label: 'CT-e' },
  { value: 'CTE_OS', label: 'CT-e OS' },
  { value: 'MDFE', label: 'MDF-e' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'OTHER', label: 'Outro' }
]

const directionOptions: Option[] = [
  { value: 'IN', label: 'Entrada' },
  { value: 'OUT', label: 'Saída' }
]

const itemTypeOptions: Option[] = [
  { value: 'PRODUCT', label: 'Produto' },
  { value: 'SERVICE', label: 'Serviço' },
  { value: 'FREIGHT', label: 'Frete' },
  { value: 'ASSET', label: 'Ativo Imobilizado' },
  { value: 'OTHER', label: 'Outro' }
]

const taxRegimeOptions: Option[] = [
  { value: 'SIMPLES_NACIONAL', label: 'Simples Nacional' },
  { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
  { value: 'LUCRO_REAL', label: 'Lucro Real' }
]

const fieldLabels: Record<string, string> = {
  name: 'Nome',
  priority: 'Prioridade',
  documentTypes: 'Tipo de documento',
  directions: 'Direção',
  cfops: 'CFOP',
  cfopPatterns: 'Padrão de CFOP',
  fiscalOperationNatureIds: 'Natureza fiscal',
  itemTypes: 'Tipo de item',
  partnerIds: 'Parceiro',
  taxRegimes: 'Regime tributário',
  minAmount: 'Valor mínimo',
  maxAmount: 'Valor máximo',
  descriptionTemplate: 'Histórico padrão',
  lines: 'Partidas'
}

function actionErrorMessage(error: string, fieldErrors?: Record<string, string[]>) {
  const details = Object.entries(fieldErrors || {})
    .flatMap(([field, messages]) => messages.map((message) => `${fieldLabels[field] || field}: ${message}`))
    .filter(Boolean)

  if (details.length === 0) return error
  return `${error} ${details.slice(0, 4).join(' ')}`
}

function clientId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

function newLine(debitCredit: DebitCredit): RuleLineForm {
  return {
    clientId: clientId(),
    debitCredit,
    accountSource: debitCredit === 'DEBIT' ? 'FIXED' : 'PARTNER_SUPPLIER',
    accountId: '',
    valueBase: 'DOCUMENT_AMOUNT',
    amountMultiplier: 1,
    memoTemplate: ''
  }
}

function initialLines(rule?: FiscalAccountingRule): RuleLineForm[] {
  if (!rule) return [newLine('DEBIT'), newLine('CREDIT')]

  return normalizedRuleLines(rule).map((line) => ({
    clientId: clientId(),
    debitCredit: line.debit_credit,
    accountSource: line.account_source,
    accountId: line.account_id || '',
    valueBase: valueBaseValues.has(line.value_base) ? line.value_base : 'DOCUMENT_AMOUNT',
    amountMultiplier: Number.isFinite(Number(line.amount_multiplier)) && Number(line.amount_multiplier) > 0 ? Number(line.amount_multiplier) : 1,
    memoTemplate: line.memo_template || ''
  }))
}

function initialList(values: string[] | null | undefined, legacyValue: string | null | undefined): string[] {
  return Array.from(new Set([...(values || []), legacyValue].filter((value): value is string => Boolean(value))))
}

function optionLabel(options: Option[], value: string) {
  return options.find((option) => option.value === value)?.label || value
}

function addUniqueValues(current: string[], nextValues: string[]) {
  return Array.from(new Set([...current, ...nextValues.map((value) => value.trim()).filter(Boolean)]))
}

function MultiPicker({
  label,
  values,
  options,
  onChange,
  placeholder = '- Qualquer -'
}: {
  label: string
  values: string[]
  options: Option[]
  onChange: (values: string[]) => void
  placeholder?: string
}) {
  const availableOptions = options.filter((option) => !values.includes(option.value))

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select
        className={inputClass}
        value=""
        onChange={(e) => {
          if (!e.target.value) return
          onChange(addUniqueValues(values, [e.target.value]))
        }}
      >
        <option value="">{placeholder}</option>
        {availableOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map((value) => (
            <span key={value} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-600">
              {optionLabel(options, value)}
              <button type="button" onClick={() => onChange(values.filter((item) => item !== value))} className="text-gray-400 hover:text-red-600 cursor-pointer" aria-label={`Remover ${optionLabel(options, value)}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function TokenField({
  label,
  values,
  onChange,
  placeholder
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState('')

  function commitDraft() {
    const nextValues = draft.split(/[,\s;]+/).map((value) => value.trim().toUpperCase()).filter(Boolean)
    if (nextValues.length === 0) return
    onChange(addUniqueValues(values, nextValues))
    setDraft('')
  }

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commitDraft()
            }
          }}
          placeholder={placeholder}
        />
        <button type="button" onClick={commitDraft} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-700 cursor-pointer">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map((value) => (
            <span key={value} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-mono font-semibold text-gray-600">
              {value}
              <button type="button" onClick={() => onChange(values.filter((item) => item !== value))} className="text-gray-400 hover:text-red-600 cursor-pointer" aria-label={`Remover ${value}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function RuleForm({ rule, chartAccounts, fiscalNatures, partners }: RuleFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const eligibleAccounts = chartAccounts.filter((a) => a.accepts_entries && !a.is_synthetic && a.is_active)
  const fiscalNatureOptions = fiscalNatures.map((nature) => ({ value: nature.id, label: `${nature.code} - ${nature.name}` }))
  const partnerOptions = partners.map((partner) => ({ value: partner.id, label: partner.name }))

  const [form, setForm] = useState<RuleFormState>(() => ({
    name: rule?.name || '',
    description: rule?.description || '',
    priority: rule?.priority ?? 100,
    documentTypes: initialList(rule?.document_types, rule?.document_type),
    directions: initialList(rule?.directions, rule?.direction),
    cfops: initialList(rule?.cfops, rule?.cfop),
    cfopPatterns: initialList(rule?.cfop_patterns, rule?.cfop_pattern),
    fiscalOperationNatureIds: initialList(rule?.fiscal_operation_nature_ids, rule?.fiscal_operation_nature_id),
    itemTypes: initialList(rule?.item_types, rule?.item_type),
    partnerIds: initialList(rule?.partner_ids, rule?.partner_id),
    taxRegimes: initialList(rule?.tax_regimes, rule?.tax_regime),
    minAmount: rule?.min_amount ? Number(rule.min_amount) : undefined,
    maxAmount: rule?.max_amount ? Number(rule.max_amount) : undefined,
    descriptionTemplate: rule?.description_template || '',
    lines: initialLines(rule)
  }))

  function update<K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateLine<K extends keyof RuleLineForm>(clientIdValue: string, key: K, value: RuleLineForm[K]) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.clientId !== clientIdValue) return line
        const next = { ...line, [key]: value }
        if (key === 'accountSource' && value !== 'FIXED') next.accountId = ''
        return next
      })
    }))
  }

  function addLine(debitCredit: DebitCredit) {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, newLine(debitCredit)] }))
  }

  function removeLine(clientIdValue: string) {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((line) => line.clientId !== clientIdValue) }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})
    const payload = {
      ...form,
      lines: form.lines.map((line) => ({
        debitCredit: line.debitCredit,
        accountSource: line.accountSource,
        accountId: line.accountSource === 'FIXED' ? line.accountId : '',
        valueBase: line.valueBase,
        amountMultiplier: line.amountMultiplier,
        memoTemplate: line.memoTemplate
      }))
    }

    startTransition(async () => {
      const res = rule ? await updateFiscalAccountingRuleAction({ id: rule.id, ...payload }) : await createFiscalAccountingRuleAction(payload)
      if (res.ok) {
        router.push('/fiscal/regras-contabeis')
        router.refresh()
      } else {
        setFieldErrors(res.fieldErrors || {})
        setErrorMsg(actionErrorMessage(res.error, res.fieldErrors))
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome da Regra *</label>
            <input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} required placeholder="Ex.: NF-e entrada genérica" />
            {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Prioridade *</label>
            <input type="number" className={inputClass} value={form.priority} onChange={(e) => update('priority', Number(e.target.value))} required />
            {fieldErrors.priority && <p className="text-xs text-red-600 mt-1">{fieldErrors.priority[0]}</p>}
          </div>
          <div className="sm:col-span-3">
            <label className={labelClass}>Descrição</label>
            <input className={inputClass} value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Condições (deixe em branco para &quot;qualquer valor&quot;)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MultiPicker label="Tipo de Documento" values={form.documentTypes} options={documentTypeOptions} onChange={(values) => update('documentTypes', values)} />
          <MultiPicker label="Direção" values={form.directions} options={directionOptions} onChange={(values) => update('directions', values)} />
          <MultiPicker label="Tipo de Item" values={form.itemTypes} options={itemTypeOptions} onChange={(values) => update('itemTypes', values)} />
          <MultiPicker label="Regime Tributário" values={form.taxRegimes} options={taxRegimeOptions} onChange={(values) => update('taxRegimes', values)} />
          <TokenField label="CFOP exato" values={form.cfops} onChange={(values) => update('cfops', values)} placeholder="Ex.: 5656, 1653, 2653" />
          <TokenField label="Padrão de CFOP (prefixo)" values={form.cfopPatterns} onChange={(values) => update('cfopPatterns', values)} placeholder="Ex.: 56, 16" />
          <MultiPicker label="Natureza Fiscal" values={form.fiscalOperationNatureIds} options={fiscalNatureOptions} onChange={(values) => update('fiscalOperationNatureIds', values)} />
          <MultiPicker label="Parceiro específico" values={form.partnerIds} options={partnerOptions} onChange={(values) => update('partnerIds', values)} />
          <div>
            <label className={labelClass}>Valor Mínimo</label>
            <input type="number" step="0.01" className={inputClass} value={form.minAmount ?? ''} onChange={(e) => update('minAmount', e.target.value === '' ? undefined : Number(e.target.value))} />
            {fieldErrors.minAmount && <p className="text-xs text-red-600 mt-1">{fieldErrors.minAmount[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Valor Máximo</label>
            <input type="number" step="0.01" className={inputClass} value={form.maxAmount ?? ''} onChange={(e) => update('maxAmount', e.target.value === '' ? undefined : Number(e.target.value))} />
            {fieldErrors.maxAmount && <p className="text-xs text-red-600 mt-1">{fieldErrors.maxAmount[0]}</p>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Partidas Geradas</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => addLine('DEBIT')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              Débito
            </button>
            <button type="button" onClick={() => addLine('CREDIT')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              Crédito
            </button>
          </div>
        </div>
        {fieldErrors.lines && <p className="text-xs font-semibold text-red-600">{fieldErrors.lines[0]}</p>}

        <div>
          <label className={labelClass}>Histórico padrão do lançamento</label>
          <input className={inputClass} value={form.descriptionTemplate} onChange={(e) => update('descriptionTemplate', e.target.value)} placeholder="Ex.: NF {numero} - {parceiro}" />
        </div>

        <div className="space-y-4">
          {form.lines.map((line, index) => (
            <div key={line.clientId} className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Partida {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeLine(line.clientId)}
                  disabled={form.lines.length <= 2}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <div>
                  <label className={labelClass}>Tipo *</label>
                  <select className={inputClass} value={line.debitCredit} onChange={(e) => updateLine(line.clientId, 'debitCredit', e.target.value as DebitCredit)}>
                    {Object.entries(DEBIT_CREDIT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Origem da Conta *</label>
                  <select className={inputClass} value={line.accountSource} onChange={(e) => updateLine(line.clientId, 'accountSource', e.target.value as AccountSource)}>
                    {accountSourceOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                {line.accountSource === 'FIXED' && (
                  <div className="sm:col-span-3">
                    <label className={labelClass}>Conta Fixa *</label>
                    <select className={inputClass} value={line.accountId} onChange={(e) => updateLine(line.clientId, 'accountId', e.target.value)} required>
                      <option value="">- Selecione -</option>
                      {eligibleAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className={labelClass}>Base do Valor *</label>
                  <select className={inputClass} value={line.valueBase} onChange={(e) => updateLine(line.clientId, 'valueBase', e.target.value as ValueBase)}>
                    {valueBaseOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Multiplicador *</label>
                  <input type="number" min="0.000001" max="999" step="0.000001" className={inputClass} value={line.amountMultiplier} onChange={(e) => updateLine(line.clientId, 'amountMultiplier', Number(e.target.value))} required />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelClass}>Histórico da partida</label>
                  <input className={inputClass} value={line.memoTemplate} onChange={(e) => updateLine(line.clientId, 'memoTemplate', e.target.value)} placeholder="Opcional; usa o histórico padrão se vazio" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
          A regra só aparece como <strong>sugestão</strong> na tela do documento fiscal. Ao confirmar, o lançamento só é gerado se as partidas com valor maior que zero ficarem balanceadas.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push('/fiscal/regras-contabeis')} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer">
          <Save className="w-4 h-4" />
          {isPending ? 'Salvando...' : rule ? 'Salvar Alterações' : 'Criar Regra'}
        </button>
      </div>
    </form>
  )
}
