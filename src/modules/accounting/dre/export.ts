import { DreReportData } from './types'
import { formatCsvCurrency } from '@/lib/csv/export-csv'

export const DRE_CSV_HEADERS = [
  { key: 'section', label: 'Seção' },
  { key: 'code', label: 'Código' },
  { key: 'description', label: 'Conta/Descrição' },
  { key: 'accountType', label: 'Tipo' },
  { key: 'amount', label: 'Valor' },
  { key: 'isSubtotal', label: 'Linha de Subtotal' }
]

/**
 * Converte o relatório consolidado da DRE para uma estrutura plana de linhas de CSV,
 * incluindo contas analíticas/sintéticas movimentadas e as linhas de subtotalização contábil clássicas.
 */
export function mapDreToCsvRows(data: DreReportData): Record<string, any>[] {
  const rows: Record<string, any>[] = []

  // Helper para adicionar linhas de subtotal
  const addSubtotal = (sectionName: string, desc: string, value: number) => {
    rows.push({
      section: sectionName,
      code: '',
      description: desc,
      accountType: 'SUBTOTAL',
      amount: formatCsvCurrency(value),
      isSubtotal: 'Sim'
    })
  }

  // Seções da DRE
  const sectionsList = [
    data.sections.revenue,
    data.sections.deductions,
    data.sections.costs,
    data.sections.expenses,
    data.sections.tax
  ]

  sectionsList.forEach((sec) => {
    // Para as contas pertencentes a esta seção
    sec.items.forEach((acc) => {
      // Valor líquido do movimento no DRE
      const rawVal = acc.displayAmount
      rows.push({
        section: sec.title,
        code: acc.code,
        description: acc.name,
        accountType: acc.account_type,
        amount: formatCsvCurrency(rawVal),
        isSubtotal: 'Não'
      })
    })

    // Adiciona o subtotal da seção
    addSubtotal(sec.title, `TOTAL ${sec.title.toUpperCase()}`, sec.total)
  })

  // Adiciona os subtotais e margens finais consolidados no rodapé
  addSubtotal('Resultado', '(=) RECEITA LÍQUIDA', data.netRevenue)
  addSubtotal('Resultado', '(=) LUCRO BRUTO', data.grossProfit)
  addSubtotal('Resultado', '(=) RESULTADO OPERACIONAL (EBITDA)', data.operatingProfit)
  addSubtotal('Resultado', '(-) PROVISÕES TRIBUTÁRIAS (IRPJ/CSLL)', -data.taxTotal)
  addSubtotal('Resultado', '(=) RESULTADO LÍQUIDO DO EXERCÍCIO', data.netProfit)

  // Adiciona a margem líquida como linha informativa
  rows.push({
    section: 'Indicador',
    code: '',
    description: 'Margem Líquida (%)',
    accountType: 'INDICATOR',
    amount: `${data.netMargin.toFixed(2).replace('.', ',')}%`,
    isSubtotal: 'Sim'
  })

  return rows
}
