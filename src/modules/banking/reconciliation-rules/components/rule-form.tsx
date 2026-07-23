'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ReconciliationRule } from '../types'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { createReconciliationRuleAction, updateReconciliationRuleAction } from '../actions'
import { AlertCircle, Save } from 'lucide-react'

interface RuleFormProps {
  rule?: ReconciliationRule
  chartAccounts: ChartAccount[]
  partners: { id: string; name: string }[]
  costCenters: { id: string; code: string; name: string }[]
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

export function RuleForm({ rule, chartAccounts, partners, costCenters }: RuleFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [form, setForm] = useState({
    name: rule?.name || '',
    keyword: rule?.keyword || '',
    direction: (rule?.direction || 'ANY') as 'CREDIT' | 'DEBIT' | 'ANY',
    counterpartyAccountId: rule?.counterparty_account_id || '',
    partnerId: rule?.partner_id || '',
    costCenterId: rule?.cost_center_id || '',
    descriptionTemplate: rule?.description_template || '',
    priority: rule?.priority || 100
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})

    startTransition(async () => {
      const res = rule
        ? await updateReconciliationRuleAction({ id: rule.id, ...form })
        : await createReconciliationRuleAction(form)

      if (res.ok) {
        router.push('/bancos/regras')
        router.refresh()
      } else {
        setErrorMsg(res.error)
        setFieldErrors(res.fieldErrors || {})
      }
    })
  }

  const eligibleAccounts = chartAccounts.filter((a) => a.accepts_entries && !a.is_synthetic && a.is_active)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Critério de Casamento</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome da Regra *</label>
            <input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ex: Recebimento PIX Vendas" required />
            {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Prioridade (menor = aplicada primeiro)</label>
            <input type="number" min={1} max={999} className={inputClass} value={form.priority} onChange={(e) => update('priority', parseInt(e.target.value) || 100)} />
          </div>
          <div>
            <label className={labelClass}>Palavra-chave (contida na descrição) *</label>
            <input className={inputClass} value={form.keyword} onChange={(e) => update('keyword', e.target.value)} placeholder="Ex: RECEBIMENTO PIX" required />
            {fieldErrors.keyword && <p className="text-xs text-red-600 mt-1">{fieldErrors.keyword[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Sentido</label>
            <select className={inputClass} value={form.direction} onChange={(e) => update('direction', e.target.value as typeof form.direction)}>
              <option value="ANY">Qualquer sentido</option>
              <option value="CREDIT">Entrada (crédito)</option>
              <option value="DEBIT">Saída (débito)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sugestão Aplicada ao Casar</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Conta Contábil de Contrapartida *</label>
            <select className={inputClass} value={form.counterpartyAccountId} onChange={(e) => update('counterpartyAccountId', e.target.value)} required>
              <option value="">— Selecione —</option>
              {eligibleAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>
              ))}
            </select>
            {fieldErrors.counterpartyAccountId && <p className="text-xs text-red-600 mt-1">{fieldErrors.counterpartyAccountId[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Parceiro (opcional)</label>
            <select className={inputClass} value={form.partnerId} onChange={(e) => update('partnerId', e.target.value)}>
              <option value="">— Nenhum —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Centro de Custo (opcional)</label>
            <select className={inputClass} value={form.costCenterId} onChange={(e) => update('costCenterId', e.target.value)}>
              <option value="">— Nenhum —</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Histórico do Lançamento Gerado (opcional — senão usa a descrição da linha)</label>
            <input className={inputClass} value={form.descriptionTemplate} onChange={(e) => update('descriptionTemplate', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[11px] text-blue-800 leading-relaxed">
        Ao casar com uma linha de extrato PENDENTE, esta regra gera um <strong>rascunho</strong> de lançamento contábil para revisão — nunca posta automaticamente. Você revisa e posta manualmente em Lançamentos.
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/bancos/regras')}
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
          {isPending ? 'Salvando...' : rule ? 'Salvar Alterações' : 'Criar Regra'}
        </button>
      </div>
    </form>
  )
}
