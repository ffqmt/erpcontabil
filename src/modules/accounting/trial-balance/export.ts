import { TrialBalanceItem } from './types'
import { formatCsvCurrency } from '@/lib/csv/export-csv'

export const TRIAL_BALANCE_CSV_HEADERS = [
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Conta' },
  { key: 'accountType', label: 'Tipo' },
  { key: 'isSynthetic', label: 'Sintética' },
  { key: 'initialBalance', label: 'Saldo Anterior' },
  { key: 'initialNature', label: 'Natureza Anterior' },
  { key: 'periodDebits', label: 'Débito Período' },
  { key: 'periodCredits', label: 'Crédito Período' },
  { key: 'finalBalance', label: 'Saldo Final' },
  { key: 'finalNature', label: 'Natureza Final D/C' },
  { key: 'status', label: 'Status' }
]

/**
 * Converte a lista de itens do Balancete para uma estrutura plana de linhas de CSV.
 */
export function mapTrialBalanceToCsvRows(items: TrialBalanceItem[]): Record<string, any>[] {
  return items.map((item) => {
    return {
      code: item.code,
      name: item.name,
      accountType: item.account_type,
      isSynthetic: item.is_synthetic ? 'Sim' : 'Não',
      initialBalance: formatCsvCurrency(item.initialBalance),
      initialNature: item.initialNature || 'D',
      periodDebits: formatCsvCurrency(item.periodDebits),
      periodCredits: formatCsvCurrency(item.periodCredits),
      finalBalance: formatCsvCurrency(item.finalBalance),
      finalNature: item.finalNature || 'D',
      status: item.is_active ? 'Ativa' : 'Inativa'
    }
  })
}
