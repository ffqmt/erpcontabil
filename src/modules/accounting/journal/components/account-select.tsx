import React from 'react'
import { ChartAccount } from '../../accounts/types'

interface AccountSelectProps {
  accounts: ChartAccount[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function AccountSelect({ accounts, value, onChange, className }: AccountSelectProps) {
  // Filtra as contas que são analíticas e ativas, ordenadas por código contábil
  const filterAnalyticActive = accounts
    .filter((acc) => !acc.is_synthetic && acc.is_active && acc.accepts_entries)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white text-gray-700 ${className || ''}`}
    >
      <option value="">Selecione uma conta analítica...</option>
      {filterAnalyticActive.map((acc) => (
        <option key={acc.id} value={acc.id} className="font-sans">
          {acc.code} — {acc.name}
        </option>
      ))}
    </select>
  )
}
