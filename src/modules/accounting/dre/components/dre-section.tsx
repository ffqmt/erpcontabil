import React from 'react'
import { DreSectionData } from '../types'
import { DreRow } from './dre-row'
import { formatCurrencyBRL } from '../dre-utils'

interface DreSectionProps {
  section: DreSectionData
  prefixSymbol: '+' | '-'
}

export function DreSection({ section, prefixSymbol }: DreSectionProps) {
  const { title, items, total } = section
  
  if (items.length === 0) return null

  const isReductive = prefixSymbol === '-'

  // Valor total da seção formatado (com sinal negativo/parenteses para subtotais redutores se isReductive)
  const displayTotal = isReductive ? -Math.abs(total) : total

  // Encontra o último filho analítico de cada conta sintética nesta seção,
  // bem como o último filho analítico da seção inteira.
  const processedItems = React.useMemo(() => {
    const mapped = items.map((item) => ({
      ...item,
      parentTotalToDisplay: null as number | null,
      sectionTotalToDisplay: null as number | null
    }))

    // 1. Associa totais de contas sintéticas ao seu último filho analítico
    mapped.forEach((item, index) => {
      if (item.is_synthetic) {
        let lastChildIndex = -1
        for (let j = index + 1; j < mapped.length; j++) {
          const potentialChild = mapped[j]
          if (potentialChild.code.startsWith(item.code + '.')) {
            if (!potentialChild.is_synthetic) {
              lastChildIndex = j
            }
          } else {
            break
          }
        }
        if (lastChildIndex !== -1) {
          mapped[lastChildIndex].parentTotalToDisplay = item.displayAmount
        }
      }
    })

    // 2. Associa o total da seção inteira ao seu último filho analítico
    let lastAnalyticalIndex = -1
    for (let i = mapped.length - 1; i >= 0; i--) {
      if (!mapped[i].is_synthetic) {
        lastAnalyticalIndex = i
        break
      }
    }
    if (lastAnalyticalIndex !== -1) {
      mapped[lastAnalyticalIndex].sectionTotalToDisplay = displayTotal
    }

    return mapped
  }, [items, displayTotal])

  return (
    <tbody className="divide-y divide-gray-100 bg-white print:divide-none">
      <tr className="bg-gray-50/70 border-y border-gray-200 text-xs font-bold text-gray-800 uppercase tracking-wider print:bg-transparent print:text-black print:border-none">
        <td colSpan={2} className="px-4 py-3 print:hidden">
          {prefixSymbol} {title}
        </td>
        <td className="hidden print:table-cell px-4 py-1.5 font-bold text-[9px] uppercase">
          {title}
        </td>
        <td className={`px-4 py-3 text-right font-mono print:hidden ${isReductive ? 'text-red-700' : 'text-emerald-700'}`}>
          {formatCurrencyBRL(displayTotal, true)}
        </td>
        <td className="hidden print:table-cell px-4 py-1.5"></td>
        <td className="hidden print:table-cell px-4 py-1.5"></td>
      </tr>

      {/* Linhas Contábeis (Contas de resultado) */}
      {processedItems.map((item) => (
        <DreRow
          key={item.id}
          item={item}
          isReductive={isReductive}
          parentTotalToDisplay={item.parentTotalToDisplay}
          sectionTotalToDisplay={item.sectionTotalToDisplay}
        />
      ))}
    </tbody>
  )
}

