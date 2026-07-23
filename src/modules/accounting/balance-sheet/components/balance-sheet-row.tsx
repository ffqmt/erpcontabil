import React from 'react'
import { BalanceSheetItem } from '../types'
import { formatCurrencyBRL } from '../balance-sheet-utils'
import { ArrowRight } from 'lucide-react'

interface BalanceSheetRowProps {
  item: BalanceSheetItem
}

export function BalanceSheetRow({ item }: BalanceSheetRowProps) {
  const { code, name, level, is_synthetic, displayAmount } = item

  // Estilos baseados na estrutura
  const rowClass = is_synthetic
    ? 'bg-gray-50/50 font-semibold text-gray-900 border-b border-gray-150/70'
    : 'text-gray-650 hover:bg-gray-50/20 border-b border-gray-105'

  const nameStyle = {
    paddingLeft: `${(level - 1) * 16}px`
  }

  const isNegative = displayAmount < -0.005

  return (
    <tr className={rowClass}>
      {/* Código da Conta */}
      <td className="px-4 py-2.5 font-mono text-xs text-gray-800 tracking-wider w-32">
        {code}
      </td>

      {/* Nome */}
      <td className="px-4 py-2.5">
        <div style={nameStyle} className="flex items-center gap-1.5">
          {level > 1 && (
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          )}
          <span>{name}</span>
        </div>
      </td>

      {/* Valor Patrimonial */}
      <td className={`px-4 py-2.5 text-right font-mono font-medium w-48 ${
        is_synthetic 
          ? 'text-gray-900 font-bold' 
          : isNegative 
            ? 'text-red-750' 
            : 'text-gray-850'
      }`}>
        {formatCurrencyBRL(displayAmount, true)}
      </td>
    </tr>
  )
}
