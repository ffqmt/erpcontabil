import { BalanceSheetReportData } from './types'
import { formatCsvCurrency } from '@/lib/csv/export-csv'

export const BALANCE_SHEET_CSV_HEADERS = [
  { key: 'group', label: 'Grupo' },
  { key: 'code', label: 'Código' },
  { key: 'description', label: 'Conta/Descrição' },
  { key: 'accountType', label: 'Tipo' },
  { key: 'amount', label: 'Valor' },
  { key: 'isCalculated', label: 'Linha Calculada' }
]

/**
 * Converte o relatório consolidado do Balanço Patrimonial para uma estrutura plana de linhas de CSV,
 * incluindo contas ativas e os totais matemáticos de verificação.
 */
export function mapBalanceSheetToCsvRows(data: BalanceSheetReportData): Record<string, any>[] {
  const rows: Record<string, any>[] = []

  // Helper para adicionar linhas calculadas (totais)
  const addCalculatedRow = (groupName: string, desc: string, value: number) => {
    rows.push({
      group: groupName,
      code: '',
      description: desc,
      accountType: 'TOTAL',
      amount: formatCsvCurrency(value),
      isCalculated: 'Sim'
    })
  }

  // 1. ATIVO
  data.assets.forEach((item) => {
    rows.push({
      group: 'ATIVO',
      code: item.code,
      description: item.name,
      accountType: item.account_type,
      amount: formatCsvCurrency(item.displayAmount),
      isCalculated: 'Não'
    })
  })
  addCalculatedRow('ATIVO', 'TOTAL DO ATIVO', data.totalAssets)

  // 2. PASSIVO
  data.liabilities.forEach((item) => {
    rows.push({
      group: 'PASSIVO',
      code: item.code,
      description: item.name,
      accountType: item.account_type,
      amount: formatCsvCurrency(item.displayAmount),
      isCalculated: 'Não'
    })
  })
  addCalculatedRow('PASSIVO', 'TOTAL DO PASSIVO', data.totalLiabilities)

  // 3. PATRIMÔNIO LÍQUIDO
  data.equity.forEach((item) => {
    rows.push({
      group: 'PATRIMÔNIO LÍQUIDO',
      code: item.code,
      description: item.name,
      accountType: item.account_type,
      amount: formatCsvCurrency(item.displayAmount),
      isCalculated: 'Não'
    })
  })
  
  // Injeta a linha calculada do Resultado do Período (Lucro ou Prejuízo Acumulado) no PL
  rows.push({
    group: 'PATRIMÔNIO LÍQUIDO',
    code: '',
    description: 'Resultado Líquido do Exercício (DRE)',
    accountType: 'EQUITY',
    amount: formatCsvCurrency(data.netPeriodResult),
    isCalculated: 'Sim'
  })
  
  addCalculatedRow('PATRIMÔNIO LÍQUIDO', 'TOTAL DO PATRIMÔNIO LÍQUIDO', data.totalEquity)

  // 4. TOTAIS CONSOLIDADOS E DIFERENÇA
  addCalculatedRow('PASSIVO E PL', 'TOTAL DO PASSIVO E PATRIMÔNIO LÍQUIDO', data.totalLiabilitiesAndEquity)
  addCalculatedRow('VERIFICAÇÃO', 'DIFERENÇA DE EQUILÍBRIO (ATIVO - PASSIVO/PL)', data.difference)

  // Linha de status do equilíbrio
  rows.push({
    group: 'STATUS',
    code: '',
    description: 'Balanço Patrimonial Equilibrado?',
    accountType: 'STATUS',
    amount: data.isBalanced ? 'Sim (Diferença Zero)' : 'Não (Divergente)',
    isCalculated: 'Sim'
  })

  return rows
}
