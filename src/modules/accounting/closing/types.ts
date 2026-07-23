import { AccountType, NormalBalance } from '../accounts/types'

export interface ClosingPreviewItem {
  id: string
  code: string
  name: string
  account_type: AccountType
  normal_balance: NormalBalance
  signedAmount: number   // Saldo atual acumulado antes do encerramento
  debitAmount: number    // Valor de zeramento a lançar a Débito
  creditAmount: number   // Valor de zeramento a lançar a Crédito
}

export interface ClosingPreviewData {
  items: ClosingPreviewItem[]
  totalRevenue: number
  totalDeductions: number
  totalCosts: number
  totalExpenses: number
  netResult: number      // Lucro ou Prejuízo Líquido (totalRevenue - totalDeductions - totalCosts - totalExpenses)
  totalLines: number
  totalDebits: number    // Soma de todos os débitos a lançar
  totalCredits: number   // Soma de todos os créditos a lançar
  targetAccount: {
    id: string
    code: string
    name: string
  } | null
}

export interface ClosingStatus {
  periodStatus: 'OPEN' | 'IN_REVIEW' | 'CLOSED' | 'REOPENED'
  hasDrafts: boolean
  hasClosing: boolean
  closingEntryId?: string
  closingEntryNumber?: string | number
  equityResultAccount: {
    id: string
    code: string
    name: string
  } | null
  draftsCount: number
}
