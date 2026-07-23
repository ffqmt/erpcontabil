import { AccountType, NormalBalance } from '../accounts/types'

export interface BalanceSheetItem {
  id: string
  code: string
  name: string
  parent_id: string | null
  account_type: AccountType
  normal_balance: NormalBalance
  level: number
  is_synthetic: boolean
  is_active: boolean
  
  // Saldos calculados
  debits: number
  credits: number
  signedAmount: number   // Débito - Crédito
  displayAmount: number  // Valor formatado segundo a normal_balance de apresentação
}

export interface BalanceSheetReportData {
  competence: string
  dateOfCut: string
  assets: BalanceSheetItem[]        // Contas de Ativo
  liabilities: BalanceSheetItem[]   // Contas de Passivo
  equity: BalanceSheetItem[]        // Contas de PL (incluindo o Resultado do Período inserido)
  
  // Totais
  totalAssets: number               // Ativo
  totalLiabilities: number          // Passivo
  totalEquityBeforeResult: number   // PL antes do resultado calculado
  netPeriodResult: number           // Linha calculada: Resultado do Período
  totalEquity: number               // PL Consolidado (PL antes + Resultado)
  totalLiabilitiesAndEquity: number // Passivo + PL
  difference: number                // Ativo - (Passivo + PL)
  isBalanced: boolean               // Diferença é zero?
  hasClosing: boolean               // Indica se o resultado já foi encerrado fisicamente
  closingEntryNumber?: string | number // Número do lançamento contábil de encerramento
}
