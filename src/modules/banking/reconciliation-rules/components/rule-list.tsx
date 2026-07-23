'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ReconciliationRule, DIRECTION_LABELS } from '../types'
import { toggleReconciliationRuleActiveAction, deleteReconciliationRuleAction } from '../actions'
import { Pencil, Power, Trash2, Calculator } from 'lucide-react'

interface RuleListProps {
  rules: ReconciliationRule[]
}

export function RuleList({ rules }: RuleListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (rules.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <Calculator className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhuma regra de conciliação cadastrada</span>
        <p className="text-xs text-gray-400 max-w-xs">Crie regras para sugerir automaticamente a conta de contrapartida e gerar rascunhos a partir de palavras-chave da descrição do extrato.</p>
      </div>
    )
  }

  function handleToggle(rule: ReconciliationRule) {
    startTransition(async () => {
      await toggleReconciliationRuleActiveAction({ id: rule.id, active: !rule.active })
      router.refresh()
    })
  }

  function handleDelete(rule: ReconciliationRule) {
    if (!window.confirm(`Excluir a regra "${rule.name}"? Lançamentos já gerados por ela não são afetados.`)) return
    startTransition(async () => {
      await deleteReconciliationRuleAction({ id: rule.id })
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
            </div>
            <p className="text-xs text-gray-500">
              Contém <code className="bg-gray-50 px-1 rounded font-mono">&quot;{rule.keyword}&quot;</code> · {DIRECTION_LABELS[rule.direction]}
            </p>
            <p className="text-xs text-gray-400">
              Sugere: {rule.counterparty_account ? `${rule.counterparty_account.code} — ${rule.counterparty_account.name}` : '—'}
              {rule.partner?.name ? ` · Parceiro: ${rule.partner.name}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/bancos/regras/${rule.id}/editar`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </Link>
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
