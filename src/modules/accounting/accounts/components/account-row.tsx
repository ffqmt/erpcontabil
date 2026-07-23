'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChartAccount } from '../types'
import { TypeBadge, BalanceBadge, SyntheticBadge, ActiveBadge } from './account-badge'
import { toggleChartAccountActiveAction } from '../actions'
import { ArrowRight, Pencil, Power } from 'lucide-react'

interface AccountRowProps {
  account: ChartAccount
  onEdit: (account: ChartAccount) => void
}

export function AccountRow({ account, onEdit }: AccountRowProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { code, name, account_type, normal_balance, is_synthetic, is_active, accepts_entries, level } = account

  // Define estilo diferenciado se for sintética
  const rowClass = is_synthetic
    ? 'bg-gray-50/70 font-semibold text-gray-900 border-b border-gray-100'
    : 'text-gray-600 hover:bg-gray-50/40 border-b border-gray-100'

  // Indentação horizontal baseada no nível da conta
  const nameStyle = {
    paddingLeft: `${(level - 1) * 20}px`
  }

  function handleToggleActive() {
    setError(null)
    startTransition(async () => {
      const res = await toggleChartAccountActiveAction({ id: account.id, active: !is_active })
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  return (
    <tr className={`${rowClass} transition-colors`}>
      {/* Código da Conta */}
      <td className="px-4 py-3.5 font-mono text-xs text-gray-800 tracking-wider">
        {code}
      </td>

      {/* Nome (com Indentação Hierárquica) */}
      <td className="px-4 py-3.5">
        <div style={nameStyle} className="flex items-center gap-2">
          {level > 1 && (
            <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
          )}
          <span className="truncate" title={name}>{name}</span>
        </div>
      </td>

      {/* Nível da Conta */}
      <td className="px-4 py-3.5 text-xs text-gray-400 font-mono text-center">
        {level}
      </td>

      {/* Tipo da Conta */}
      <td className="px-4 py-3.5 text-center">
        <TypeBadge type={account_type} />
      </td>

      {/* Natureza */}
      <td className="px-4 py-3.5 text-center">
        <BalanceBadge balance={normal_balance} />
      </td>

      {/* Sintética / Analítica */}
      <td className="px-4 py-3.5 text-center">
        <SyntheticBadge isSynthetic={is_synthetic} />
      </td>

      {/* Aceita Lançamento */}
      <td className="px-4 py-3.5 text-center text-xs">
        {is_synthetic ? (
          <span className="text-gray-400 font-medium">Bloqueado</span>
        ) : accepts_entries ? (
          <span className="text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded font-medium">
            Permitido
          </span>
        ) : (
          <span className="text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium" title={account.non_entry_reason || ''}>
            Restrito
          </span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3.5 text-center">
        <ActiveBadge isActive={is_active} />
      </td>

      {/* Ações */}
      <td className="px-4 py-3.5 text-center whitespace-nowrap">
        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={() => onEdit(account)} title="Editar conta" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={isPending}
            title={is_active ? 'Inativar conta' : 'Reativar conta'}
            className={`p-1.5 rounded cursor-pointer disabled:opacity-40 ${is_active ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        </div>
        {error && <p className="text-[10px] text-red-600 mt-1 max-w-[140px] whitespace-normal ml-auto">{error}</p>}
      </td>
    </tr>
  )
}
