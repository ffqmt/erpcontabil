import React from 'react'
import { BalanceSheetItem } from '../types'
import { BalanceSheetRow } from './balance-sheet-row'
import { formatCurrencyBRL } from '../balance-sheet-utils'

interface BalanceSheetSectionProps {
  title: string
  items: BalanceSheetItem[]
  total: number
}

export function BalanceSheetSection({ title, items, total }: BalanceSheetSectionProps) {
  if (items.length === 0) return null

  return (
    <tbody className="divide-y divide-gray-100 bg-white">
      {/* Título do Grupo */}
      <tr className="bg-gray-50/70 border-y border-gray-200 text-xs font-bold text-gray-800 uppercase tracking-wider">
        <td colSpan={2} className="px-4 py-3">
          {title}
        </td>
        <td className="px-4 py-3 text-right font-mono text-gray-900 font-bold">
          {formatCurrencyBRL(total, true)}
        </td>
      </tr>

      {/* Linhas */}
      {items.map((item) => (
        <BalanceSheetRow key={item.id} item={item} />
      ))}
    </tbody>
  )
}
