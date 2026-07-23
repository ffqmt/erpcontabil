'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FiscalImportClassificationRule } from '../types'
import { createImportClassificationRuleAction, updateImportClassificationRuleAction } from '../actions'
import { AlertCircle, Save } from 'lucide-react'

interface SimplePartner {
  id: string
  name: string
}

interface SimpleNature {
  id: string
  code: string
  name: string
}

interface SimpleItem {
  id: string
  description: string
}

interface RuleFormProps {
  rule?: FiscalImportClassificationRule
  partners: SimplePartner[]
  natures: SimpleNature[]
  items: SimpleItem[]
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

const EXPECTED_RETENTION_OPTIONS = [
  ['ISS', 'ISS Retido'],
  ['INSS_RETIDO', 'INSS Retido'],
  ['IRRF', 'IRRF'],
  ['PIS', 'PIS Retido'],
  ['COFINS', 'COFINS Retido'],
  ['PCC', 'CSLL/PCC Retido']
] as const

export function RuleForm({ rule, partners, natures, items }: RuleFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [form, setForm] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    priority: rule?.priority ?? 100,
    active: rule?.active ?? true,
    partnerId: rule?.partner_id || '',
    issuerCnpj: rule?.issuer_cnpj || '',
    xmlCfopPattern: rule?.xml_cfop_pattern || '',
    ncmPattern: rule?.ncm_pattern || '',
    cest: rule?.cest || '',
    supplierProductCode: rule?.supplier_product_code || '',
    supplierDescriptionPattern: rule?.supplier_description_pattern || '',
    documentType: rule?.document_type || '',
    direction: rule?.direction || '',
    minAmount: rule?.min_amount != null ? String(rule.min_amount) : '',
    maxAmount: rule?.max_amount != null ? String(rule.max_amount) : '',
    itemId: rule?.item_id || '',
    fiscalOperationNatureId: rule?.fiscal_operation_nature_id || '',
    bookkeepingCfop: rule?.bookkeeping_cfop || '',
    taxSituationCode: rule?.tax_situation_code || '',
    itemFiscalUsage: rule?.item_fiscal_usage || '',
    itemKind: rule?.item_kind || '',
    generatesCredit: rule?.generates_credit ?? undefined,
    expectedRetentions: rule?.expected_retentions || ([] as string[]),
    createPartnerItemMapping: rule?.create_partner_item_mapping ?? false
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleRetention(value: string) {
    setForm((prev) => ({
      ...prev,
      expectedRetentions: prev.expectedRetentions.includes(value)
        ? prev.expectedRetentions.filter((v) => v !== value)
        : [...prev.expectedRetentions, value]
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})

    const payload = {
      ...form,
      minAmount: form.minAmount === '' ? undefined : Number(form.minAmount),
      maxAmount: form.maxAmount === '' ? undefined : Number(form.maxAmount)
    }

    startTransition(async () => {
      const res = rule
        ? await updateImportClassificationRuleAction({ id: rule.id, ...payload })
        : await createImportClassificationRuleAction(payload)

      if (res.ok) {
        router.push('/fiscal/configuracoes/regras-importacao')
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome *</label>
            <input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} required />
            {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Prioridade *</label>
            <input type="number" min={1} max={999} className={inputClass} value={form.priority} onChange={(e) => update('priority', Number(e.target.value))} required />
            <p className="text-[10px] text-gray-400 mt-1">Menor número = maior prioridade.</p>
          </div>
          <div className="sm:col-span-3">
            <label className={labelClass}>Descrição</label>
            <input className={inputClass} value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
            Regra ativa
          </label>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Condições (deixe em branco = coringa)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Parceiro</label>
            <select className={inputClass} value={form.partnerId} onChange={(e) => update('partnerId', e.target.value)}>
              <option value="">— Qualquer —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>CNPJ do Emitente</label>
            <input className={inputClass} value={form.issuerCnpj} onChange={(e) => update('issuerCnpj', e.target.value)} placeholder="somente números" />
          </div>
          <div>
            <label className={labelClass}>CFOP do XML (prefixo)</label>
            <input className={inputClass} value={form.xmlCfopPattern} onChange={(e) => update('xmlCfopPattern', e.target.value)} placeholder="ex.: 51 casa 5101, 5102..." />
          </div>
          <div>
            <label className={labelClass}>NCM (prefixo)</label>
            <input className={inputClass} value={form.ncmPattern} onChange={(e) => update('ncmPattern', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>CEST</label>
            <input className={inputClass} value={form.cest} onChange={(e) => update('cest', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Código do Produto no Fornecedor</label>
            <input className={inputClass} value={form.supplierProductCode} onChange={(e) => update('supplierProductCode', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Descrição do Item Contém</label>
            <input className={inputClass} value={form.supplierDescriptionPattern} onChange={(e) => update('supplierDescriptionPattern', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Tipo de Documento</label>
            <select className={inputClass} value={form.documentType} onChange={(e) => update('documentType', e.target.value)}>
              <option value="">— Qualquer —</option>
              <option value="NFE">NF-e</option>
              <option value="NFCE">NFC-e</option>
              <option value="NFSE">NFS-e</option>
              <option value="CTE">CT-e</option>
              <option value="CTE_OS">CT-e OS</option>
              <option value="MANUAL">Documento Manual</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Direção</label>
            <select className={inputClass} value={form.direction} onChange={(e) => update('direction', e.target.value as '' | 'IN' | 'OUT')}>
              <option value="">— Qualquer —</option>
              <option value="IN">Entrada</option>
              <option value="OUT">Saída</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Valor Mínimo do Item</label>
            <input type="number" step="0.01" className={inputClass} value={form.minAmount} onChange={(e) => update('minAmount', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Valor Máximo do Item</label>
            <input type="number" step="0.01" className={inputClass} value={form.maxAmount} onChange={(e) => update('maxAmount', e.target.value)} />
            {fieldErrors.maxAmount && <p className="text-xs text-red-600 mt-1">{fieldErrors.maxAmount[0]}</p>}
          </div>
        </div>
        <p className="text-[10px] text-gray-400 border-t border-gray-100 pt-2">
          UF de origem/destino e município ainda não são preenchidos pelo parser na importação de XML nesta subetapa — condições configuradas para esses campos não terão efeito até uma etapa futura (documentado em docs/implementacao-35b1a-motor-fiscal-natureza-regras-importacao.md).
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Natureza Fiscal a Aplicar</label>
            <select className={inputClass} value={form.fiscalOperationNatureId} onChange={(e) => update('fiscalOperationNatureId', e.target.value)}>
              <option value="">— Não aplicar —</option>
              {natures.map((n) => (
                <option key={n.id} value={n.id}>{n.code} — {n.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>CFOP de Escrituração a Aplicar</label>
            <input className={inputClass} value={form.bookkeepingCfop} onChange={(e) => update('bookkeepingCfop', e.target.value)} placeholder="ex.: 1102" />
          </div>
          <div>
            <label className={labelClass}>CST/CSOSN a Aplicar</label>
            <input className={inputClass} value={form.taxSituationCode} onChange={(e) => update('taxSituationCode', e.target.value)} placeholder="ex.: 00 ou 102" />
          </div>
          <div>
            <label className={labelClass}>Tipo de Item a Aplicar</label>
            <select className={inputClass} value={form.itemKind} onChange={(e) => update('itemKind', e.target.value as typeof form.itemKind)}>
              <option value="">— Não aplicar —</option>
              <option value="PRODUCT">Produto</option>
              <option value="SERVICE">Serviço</option>
              <option value="FREIGHT">Frete</option>
              <option value="ASSET">Ativo Imobilizado</option>
              <option value="OTHER">Outro</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Retenções Esperadas a Aplicar</label>
          <div className="flex flex-wrap gap-3">
            {EXPECTED_RETENTION_OPTIONS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-1.5 text-xs text-gray-700">
                <input type="checkbox" checked={form.expectedRetentions.includes(value)} onChange={() => toggleRetention(value)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={form.createPartnerItemMapping} onChange={(e) => update('createPartnerItemMapping', e.target.checked)} />
            Criar/atualizar mapeamento fornecedor→produto automaticamente
          </label>
          {form.createPartnerItemMapping && (
            <div>
              <label className={labelClass}>Produto Interno (alvo do mapeamento)</label>
              <select className={inputClass} value={form.itemId} onChange={(e) => update('itemId', e.target.value)}>
                <option value="">— Selecione um produto —</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>{it.description}</option>
                ))}
              </select>
              {fieldErrors.itemId && <p className="text-xs text-red-600 mt-1">{fieldErrors.itemId[0]}</p>}
              <p className="text-[10px] text-gray-400 mt-1">Obrigatório para criar ou atualizar o mapeamento automático do código do fornecedor.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push('/fiscal/configuracoes/regras-importacao')} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer">
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
