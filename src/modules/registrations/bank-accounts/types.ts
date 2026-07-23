export type BankAccountType = 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT'

export interface BankAccount {
  id: string
  workspace_id: string
  company_id: string
  chart_account_id: string
  bank_name: string | null
  bank_code: string | null
  agency: string | null
  account_number: string | null
  account_digit: string | null
  account_type: BankAccountType
  holder_name: string | null
  holder_document: string | null
  opening_balance: number | string | null
  active: boolean
  created_at: string
  updated_at: string
  chart_account?: {
    code: string
    name: string
  } | null
}
