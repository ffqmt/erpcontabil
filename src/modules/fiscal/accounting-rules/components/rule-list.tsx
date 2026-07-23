'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ACCOUNT_SOURCE_LABELS, DEBIT_CREDIT_LABELS, FiscalAccountingRule, VALUE_BASE_LABELS } from '../types'
import { normalizedRuleLines } from '../utils'
import { toggleFiscalAccountingRuleActiveAction, deleteFiscalAccountingRuleAction, duplicateFiscalAccountingRuleAction } from '../actions'
import { Copy, Pencil, Power, Trash2, ScrollText } from 'lucide-react'

interface RuleListProps {
  rules: FiscalAccountingRule[]
}

function lineAccountLabel(line: ReturnType<typeof normalizedRuleLines>[number]) {
  if (line.account_source === 'FIXED') return line.account ? `${line.account.code} — ${line.account.name}` : '(conta fixa não configurada)'
  return ACCOUNT_SOURCE_LABELS[line.account_source]
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
}

function conditionValues(values: string[] | null | undefined, legacyValue: string | null | undefined): string[] {
  if (values?.length) return uniqueValues(values)
  return uniqueValues([legacyValue])
}

function conditionSummary(rule: FiscalAccountingRule) {
  const parts: string[] = []
  const cfops = conditionValues(rule.cfops, rule.cfop)
  const cfopPatterns = conditionValues(rule.cfop_patterns, rule.cfop_pattern)
  const natureIds = conditionValues(rule.fiscal_operation_nature_ids, rule.fiscal_operation_nature_id)
  const partnerIds = conditionValues(rule.partner_ids, rule.partner_id)
  const itemTypes = conditionValues(rule.item_types, rule.item_type)
  const taxRegimes = conditionValues(rule.tax_regimes, rule.tax_regime)

  if (cfops.length) parts.push(`CFOP ${cfops.join(', ')}`)
  if (cfopPatterns.length) parts.push(`CFOP começa com ${cfopPatterns.join(', ')}`)
  if (partnerIds.length === 1 && rule.partner?.name) parts.push(`Parceiro: ${rule.partner.name}`)
  if (partnerIds.length > 1) parts.push(`${partnerIds.length} parceiros`)
  if (natureIds.length === 1 && rule.fiscal_operation_nature?.name) parts.push(`Natureza: ${rule.fiscal_operation_nature.name}`)
  if (natureIds.length > 1) parts.push(`${natureIds.length} naturezas`)
  if (itemTypes.length) parts.push(`Itens: ${itemTypes.join(', ')}`)
  if (taxRegimes.length) parts.push(`Regime: ${taxRegimes.join(', ')}`)

  return parts.join(' · ')
}

export function RuleList({ rules }: RuleListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (rules.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <ScrollText className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhuma regra contábil fiscal cadastrada</span>
        <p className="text-xs text-gray-400 max-w-sm">
          Crie regras para sugerir automaticamente débito/crédito ao contabilizar documentos fiscais — sem hardcode de
          fornecedor/cliente/conta.
        </p>
      </div>
    )
  }

  function handleToggle(rule: FiscalAccountingRule) {
    startTransition(async () => {
      await toggleFiscalAccountingRuleActiveAction({ id: rule.id, active: !rule.active })
      router.refresh()
    })
  }

  function handleDelete(rule: FiscalAccountingRule) {
    if (!window.confirm(`Excluir a regra "${rule.name}"?`)) return
    startTransition(async () => {
      const res = await deleteFiscalAccountingRuleAction({ id: rule.id })
      if (!res.ok) window.alert(res.error)
      router.refresh()
    })
  }

  function handleDuplicate(rule: FiscalAccountingRule) {
    startTransition(async () => {
      const res = await duplicateFiscalAccountingRuleAction({ id: rule.id })
      if (!res.ok) {
        window.alert(res.error)
        return
      }
      router.push(`/fiscal/regras-contabeis/${res.data.id}/editar`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <div key={rule.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between hover:shadow-sm transition-shadow">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-800 text-sm truncate">{rule.name}</span>
              <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">prio {rule.priority}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${rule.active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {rule.active ? 'Ativa' : 'Inativa'}
              </span>
              {rule.direction && <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{rule.direction === 'IN' ? 'Entrada' : 'Saída'}</span>}
              {rule.document_type && <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{rule.document_type}</span>}
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              {normalizedRuleLines(rule).slice(0, 4).map((line) => (
                <p key={line.id || `${line.line_order}-${line.debit_credit}`}>
                  <span className="font-semibold text-gray-700">{DEBIT_CREDIT_LABELS[line.debit_credit]}</span>: {lineAccountLabel(line)} · {VALUE_BASE_LABELS[line.value_base]} x {Number(line.amount_multiplier ?? 1)}
                </p>
              ))}
              {normalizedRuleLines(rule).length > 4 && (
                <p className="text-gray-400">+ {normalizedRuleLines(rule).length - 4} partida(s)</p>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {normalizedRuleLines(rule).length} partida(s)
              {conditionSummary(rule) ? ` · ${conditionSummary(rule)}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/fiscal/regras-contabeis/${rule.id}/editar`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </Link>
            <button
              onClick={() => handleDuplicate(rule)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-indigo-300 hover:text-indigo-700 text-gray-500 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicar
            </button>
            <button
              onClick={() => handleToggle(rule)}
              disabled={isPending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
                rule.active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {rule.active ? 'Desativar' : 'Ativar'}
            </button>
            <button
              onClick={() => handleDelete(rule)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-red-300 hover:text-red-600 text-gray-500 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
