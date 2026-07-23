export type JournalOrigin =
  | 'MANUAL'
  | 'OPENING'
  | 'FISCAL_DOCUMENT'
  | 'FISCAL_ASSESSMENT'
  | 'PAYROLL_SUMMARY'
  | 'PAYROLL_PAYMENT'
  | 'BANK_STATEMENT'
  | 'ASSET_ACQUISITION'
  | 'ASSET_DEPRECIATION'
  | 'ASSET_DISPOSAL'
  | 'IRPJ_CSLL'
  | 'RESULT_CLOSING'
  | 'REVERSAL'

export type JournalStatus =
  | 'DRAFT'
  | 'POSTED'
  | 'REVERSED'
  | 'CANCELLED'
  | 'PENDING_CLASSIFICATION'

export type DebitCredit = 'DEBIT' | 'CREDIT'

export interface JournalEntryLine {
  id: string
  workspace_id: string
  company_id: string
  journal_entry_id: string
  account_id: string
  debit_credit: DebitCredit
  amount: number | string // No banco retorna numeric (string em JS via pg)
  memo: string | null
  cost_center_id: string | null
  reconciled: boolean
  bank_statement_line_id: string | null
  created_at: string
  updated_at: string
  // Dados populados do join/relacionamentos
  account?: {
    code: string
    name: string
    account_type: string
  } | null
  cost_center?: {
    code: string
    name: string
  } | null
}

export interface JournalEntry {
  id: string
  workspace_id: string
  company_id: string
  establishment_id: string | null
  number: number | null // bigint em bigint em sql
  entry_date: string // date
  competence: string // date
  description: string
  document: string | null
  partner_id: string | null
  origin: JournalOrigin
  status: JournalStatus
  reversal_of_id: string | null
  reversed_by_entry_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Linhas associadas
  lines: JournalEntryLine[]
}
