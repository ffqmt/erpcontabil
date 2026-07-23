import { AccountType, NormalBalance } from '../accounts/types'

export interface TrialBalanceItem {
  id: string
  code: string
  name: string
  parent_id: string | null
  account_type: AccountType
  normal_balance: NormalBalance
  level: number
  is_synthetic: boolean
  is_active: boolean
  accepts_entries: boolean
  
  // Saldos calculados
  initialBalance: number     // Saldo anterior
  initialNature: 'D' | 'C'   // Natureza do saldo anterior
  periodDebits: number       // Débitos do período
  periodCredits: number      // Créditos do período
  finalBalance: number       // Saldo final
  finalNature: 'D' | 'C'     // Natureza do saldo final
}

export interface TrialBalanceSummaryData {
  periodDebitsTotal: number
  periodCreditsTotal: number
  periodDifference: number
  finalDebitsTotal: number
  finalCreditsTotal: number
  finalDifference: number
  activeAccountsCount: number
}
