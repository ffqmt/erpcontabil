import React from 'react'
import { TrialBalanceItem } from '../types'
import { formatCurrencyBRL, formatNumberBRL, getNatureBadgeStyle, getAccountTypeLabel } from '../trial-balance-utils'
import { ArrowRight } from 'lucide-react'

interface TrialBalanceRowProps {
  item: TrialBalanceItem
  sequenceNumber: number
}

export function TrialBalanceRow({ item, sequenceNumber }: TrialBalanceRowProps) {
  const {
    code,
    name,
    level,
    is_synthetic,
    initialBalance,
    initialNature,
    periodDebits,
    periodCredits,
    finalBalance,
    finalNature,
    account_type,
    is_active
  } = item

  // Estilização diferenciada se for conta sintética (grupo contábil)
  const isZero = initialBalance < 0.01 && periodDebits < 0.01 && periodCredits < 0.01 && finalBalance < 0.01
  
  let rowClass = 'text-gray-650 hover:bg-gray-50/40 transition-colors border-b border-gray-100 print:text-black print:border-none print:hover:bg-transparent'
  if (is_synthetic) {
    rowClass = 'bg-gray-50/70 font-semibold text-gray-900 border-b border-gray-100 print:text-black print:font-bold print:bg-transparent print:border-none'
  } else if (isZero) {
    rowClass = 'text-gray-400/80 hover:bg-gray-50/20 border-b border-gray-100 print:text-black print:border-none print:hover:bg-transparent'
  }

  // Estilo de indentação proporcional ao nível
  const nameStyle = {
    paddingLeft: `${(level - 1) * 12}px`
  }

  // Helper para renderizar moeda de forma opaca se for zero
  const renderValue = (val: number, highlightColor?: string, showNature?: 'D' | 'C') => {
    const isValZero = val < 0.005
    
    return (
      <div className="font-mono text-right">
        {/* Tela (Com R$ e Badge de Natureza) */}
        <div className="print:hidden flex items-center justify-end gap-1">
          {isValZero ? (
            <span className="text-gray-350">R$ 0,00</span>
          ) : (
            <span className={highlightColor || 'text-gray-800'}>{formatCurrencyBRL(val)}</span>
          )}
          {!isValZero && showNature && (
            <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${getNatureBadgeStyle(showNature)}`}>
              {showNature}
            </span>
          )}
        </div>

        {/* Impressão (Sem R$ e Natureza junto ao número) */}
        <div className="hidden print:block text-[9px] font-normal">
          {isValZero ? (
            <span>0,00</span>
          ) : (
            <span>
              {formatNumberBRL(val)}
              {showNature || ''}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <tr className={rowClass}>
      {/* Código da Conta */}
      <td className="px-4 py-3 font-mono text-xs text-gray-800 tracking-wider print:text-[9px] print:py-1">
        <span className="print:hidden">{code}</span>
        <span className="hidden print:inline">{sequenceNumber}</span>
      </td>

      {/* Classificação (Apenas Impressão) */}
      <td className="hidden print:table-cell px-4 py-1 font-mono text-[9px] text-gray-800 tracking-wider">
        {code}
      </td>

      {/* Nome da Conta (Indentado) */}
      <td className="px-4 py-3 print:py-1 print:text-[9px]">
        <div style={nameStyle} className="flex items-center gap-1.5">
          {level > 1 && (
            <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0 print:hidden" />
          )}
          <span className="truncate" title={name}>{name}</span>
        </div>
      </td>

      {/* Saldo Anterior */}
      <td className="px-4 py-3 text-right print:py-1">
        {renderValue(initialBalance, undefined, initialNature)}
      </td>

      {/* Débito do Período */}
      <td className="px-4 py-3 text-right print:py-1">
        {renderValue(periodDebits, 'text-blue-700')}
      </td>

      {/* Crédito do Período */}
      <td className="px-4 py-3 text-right print:py-1">
        {renderValue(periodCredits, 'text-amber-700')}
      </td>

      {/* Saldo Final */}
      <td className="px-4 py-3 text-right print:py-1">
        {renderValue(finalBalance, is_synthetic ? 'text-gray-900 font-bold' : 'text-gray-800 font-semibold', finalNature)}
      </td>

      {/* Tipo de Conta */}
      <td className="px-4 py-3 text-xs text-gray-400 text-center print:hidden">
        {getAccountTypeLabel(account_type)}
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-center text-xs print:hidden">
        {is_active ? (
          <span className="text-green-600 bg-green-50 px-1 py-0.5 rounded text-[10px] font-semibold border border-green-200">
            Ativa
          </span>
        ) : (
          <span className="text-gray-400 bg-gray-50 px-1 py-0.5 rounded text-[10px] border border-gray-200">
            Inativa
          </span>
        )}
      </td>
    </tr>
  )
}

