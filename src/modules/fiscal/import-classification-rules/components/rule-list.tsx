'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiscalImportClassificationRule } from '../types'
import { toggleImportClassificationRuleActiveAction, deleteImportClassificationRuleAction } from '../actions'
import { Pencil, Power, Trash2, ListFilter } from 'lucide-react'

interface RuleListProps {
  rules: FiscalImportClassificationRule[]
}

function conditionSummary(rule: FiscalImportClassificationRule): string {
  const parts: string[] = []
  if (rule.partner?.name) parts.push(`parceiro: ${rule.partner.name}`)
  if (rule.issuer_cnpj) parts.push(`CNPJ emitente: ${rule.issuer_cnpj}`)
  if (rule.xml_cfop_pattern) parts.push(`CFOP XML: ${rule.xml_cfop_pattern}*`)
  if (rule.ncm_pattern) parts.push(`NCM: ${rule.ncm_pattern}*`)
  if (rule.document_type) parts.push(`tipo: ${rule.document_type}`)
  if (rule.direction) parts.push(rule.direction === 'IN' ? 'entrada' : 'saída')
  if (rule.supplier_product_code) parts.push(`código fornecedor: ${rule.supplier_product_code}`)
  return parts.length > 0 ? parts.join(' · ') : 'sem condições (casa com tudo)'
}

function actionSummary(rule: FiscalImportClassificationRule): string {
  const parts: string[] = []
  if (rule.fiscal_operation_nature?.name) parts.push(`natureza: ${rule.fiscal_operation_nature.name}`)
  if (rule.bookkeeping_cfop) parts.push(`CFOP escrituração: ${rule.bookkeeping_cfop}`)
  if (rule.tax_situation_code) parts.push(`CST/CSOSN: ${rule.tax_situation_code}`)
  if (rule.item_kind) parts.push(`tipo item: ${rule.item_kind}`)
  if (rule.create_partner_item_mapping) parts.push('cria mapeamento fornecedor→produto')
  return parts.length > 0 ? parts.join(' · ') : 'nenhuma ação configurada'
}

function RuleRow({ rule }: { rule: FiscalImportClassificationRule }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      await toggleImportClassificationRuleActiveAction({ id: rule.id, active: !rule.active })
      router.refresh()
    })
  }

  function handleDelete() {
    if (!window.confirm(`Remover a regra "${rule.name}"?`)) return
    startTransition(async () => {
      await deleteImportClassificationRuleAction({ id: rule.id })
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] text-gray-400">prioridade {rule.priority}</span>
            <span className="font-bold text-gray-800 text-sm truncate">{rule.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${rule.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {rule.active ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          {rule.description && <p className="text-xs text-gray-500">{rule.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href={`/fiscal/configuracoes/regras-importacao/${rule.id}/editar`} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors">
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </Link>
          <button onClick={handleToggle} disabled={isPending} className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${rule.active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
            <Power className="w-3.5 h-3.5" />
            {rule.active ? 'Desativar' : 'Ativar'}
          </button>
          <button onClick={handleDelete} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-2 space-y-1">
        <p><span className="font-semibold text-gray-600">Condições:</span> {conditionSummary(rule)}</p>
        <p><span className="font-semibold text-gray-600">Ações:</span> {actionSummary(rule)}</p>
      </div>
    </div>
  )
}

export function RuleList({ rules }: RuleListProps) {
  if (rules.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <ListFilter className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhuma regra de importação cadastrada</span>
        <p className="text-xs text-gray-400 max-w-sm">Regras de Importação aplicam Natureza Fiscal, CFOP de escrituração e CST automaticamente quando um XML casa com as condições configuradas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <RuleRow key={rule.id} rule={rule} />
      ))}
    </div>
  )
}
