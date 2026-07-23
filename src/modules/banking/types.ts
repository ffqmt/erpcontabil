export type BankStatementLineStatus = 'PENDING' | 'CLASSIFIED' | 'RECONCILED' | 'IGNORED' | 'ERROR'
export type BankStatementImportStatus = 'SUCCESS' | 'WARNING' | 'ERROR' | 'PROCESSING'

export interface BankStatementImport {
  id: string
  workspace_id: string
  company_id: string
  bank_account_id: string
  file_name: string | null
  source: string
  status: BankStatementImportStatus
  message: string | null
  total_lines: number
  valid_lines: number
  invalid_lines: number
  duplicate_lines: number
  notes: string | null
  created_at: string
  updated_at: string
  bank_account?: {
    bank_name: string | null
  } | null
}

export interface BankStatementLine {
  id: string
  workspace_id: string
  company_id: string
  bank_account_id: string
  bank_statement_import_id: string | null
  entry_date: string
  description: string
  document_number: string | null
  amount: number | string
  balance: number | string | null
  hash: string
  status: BankStatementLineStatus
  counterparty_account_id: string | null
  partner_id: string | null
  cost_center_id: string | null
  journal_entry_line_id: string | null
  classification_memo: string | null
  error_message: string | null
  reconciled_at: string | null
  created_at: string
  updated_at: string
  bank_account?: {
    bank_name: string | null
  } | null
  counterparty_account?: {
    code: string
    name: string
  } | null
  partner?: {
    name: string
  } | null
  cost_center?: {
    code: string
    name: string
  } | null
  journal_entry_line?: {
    journal_entry_id: string
    journal_entry?: {
      number: number | null
      status: string
    } | null
  } | null
}

export interface BankStatementLineFilters {
  bankAccountId?: string
  status?: BankStatementLineStatus
  dateFrom?: string
  dateTo?: string
  text?: string
}

export interface BankingDashboardData {
  bankAccountsCount: number
  importsCount: number
  pendingLinesCount: number
  reconciledThisMonthCount: number
  errorLinesCount: number
  totalPendingInflow: number
  totalPendingOutflow: number
}

export interface ParsedCsvRow {
  lineNumber: number
  raw: string
  entryDate?: string
  description?: string
  documentNumber?: string
  amount?: number
  balance?: number
  error?: string
}

export interface ParsedCsvValidRow {
  lineNumber: number
  raw: string
  entryDate: string
  description: string
  documentNumber?: string
  amount: number
  balance?: number
}

export interface ParsedCsvResult {
  validRows: ParsedCsvValidRow[]
  invalidRows: { lineNumber: number; raw: string; error: string }[]
  totalLines: number
}
