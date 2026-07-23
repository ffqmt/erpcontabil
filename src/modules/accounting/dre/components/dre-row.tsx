import { formatCurrencyBRL, formatDreValue } from '../dre-utils'
import { DreItem } from '../types'
import { ArrowRight } from 'lucide-react'

interface DreRowProps {
  item: DreItem
  isReductive?: boolean
  parentTotalToDisplay?: number | null
  sectionTotalToDisplay?: number | null
}

export function DreRow({
  item,
  isReductive = false,
  parentTotalToDisplay = null,
  sectionTotalToDisplay = null
}: DreRowProps) {
  const { code, name, level, is_synthetic, displayAmount } = item

  // Estilos visuais baseados na estrutura
  const rowClass = is_synthetic
    ? 'bg-gray-50/50 font-semibold text-gray-900 border-b border-gray-150/70 print:text-black print:bg-transparent print:border-none print:font-bold'
    : 'text-gray-650 hover:bg-gray-50/20 border-b border-gray-105 print:text-black print:border-none print:hover:bg-transparent'

  const nameStyle = {
    paddingLeft: `${(level - 1) * 12}px`
  }

  // Modifica o sinal para exibição se for redutor
  const displayVal = isReductive ? -Math.abs(displayAmount) : displayAmount

  return (
    <tr className={rowClass}>
      {/* Código da Conta (Somente Tela) */}
      <td className="px-4 py-2.5 font-mono text-xs text-gray-800 tracking-wider w-32 print:hidden">
        {code}
      </td>

      {/* Nome (com recuo) */}
      <td className="px-4 py-2.5 print:py-1">
        <div style={nameStyle} className="flex items-center gap-1.5 print:text-[9px] print:text-black">
          {level > 1 && (
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 print:hidden" />
          )}
          <span className={is_synthetic ? 'font-bold uppercase' : ''}>{name}</span>
        </div>
      </td>

      {/* Valor display contábil (Somente Tela) */}
      <td className={`px-4 py-2.5 text-right font-mono font-medium w-48 print:hidden ${
        is_synthetic 
          ? 'text-gray-900 font-bold' 
          : isReductive 
            ? 'text-red-700' 
            : 'text-gray-850'
      }`}>
        {formatCurrencyBRL(displayVal, true)}
      </td>

      {/* Saldo (Somente Impressão - apenas analítico) */}
      <td className="hidden print:table-cell px-4 py-1 text-right font-mono text-[9px] text-black">
        {!is_synthetic && formatDreValue(displayVal)}
      </td>

      {/* Total (Somente Impressão - subtotais ou totais de grupo) */}
      <td className="hidden print:table-cell px-4 py-1 text-right font-mono text-[9px] font-bold text-black">
        {parentTotalToDisplay !== null && parentTotalToDisplay !== undefined && (
          <span className="border-b border-black pb-0.5">{formatDreValue(parentTotalToDisplay)}</span>
        )}
        {parentTotalToDisplay === null && sectionTotalToDisplay !== null && sectionTotalToDisplay !== undefined && (
          <span className="border-b border-black pb-0.5">{formatDreValue(sectionTotalToDisplay)}</span>
        )}
      </td>
    </tr>
  )
}

