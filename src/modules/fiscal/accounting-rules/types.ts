export type AccountSource = 'FIXED' | 'PARTNER_CUSTOMER' | 'PARTNER_SUPPLIER'
export type DebitCredit = 'DEBIT' | 'CREDIT'
export type ValueBase =
  | 'DOCUMENT_AMOUNT'
  | 'MERCHANDISE_AMOUNT'
  | 'SERVICES_AMOUNT'
  | 'TOTAL_AMOUNT'
  | 'FREIGHT_AMOUNT'
  | 'INSURANCE_AMOUNT'
  | 'DISCOUNT_AMOUNT'
  | 'OTHER_EXPENSES_AMOUNT'
  | 'ICMS_AMOUNT'
  | 'IPI_AMOUNT'
  | 'PIS_AMOUNT'
  | 'COFINS_AMOUNT'
  | 'ISS_AMOUNT'
export type ApplicationMode = 'MANUAL' | 'RULE_SUGGESTED' | 'RULE_AUTO_DRAFT'
export type ApplicationStatus = 'APPLIED' | 'REVERSED' | 'ERROR'

export const ACCOUNT_SOURCE_LABELS: Record<AccountSource, string> = {
  FIXED: 'conta fixa',
  PARTNER_CUSTOMER: 'conta do cliente',
  PARTNER_SUPPLIER: 'conta do fornecedor'
}

export const DEBIT_CREDIT_LABELS: Record<DebitCredit, string> = {
  DEBIT: 'Débito',
  CREDIT: 'Crédito'
}

export const VALUE_BASE_LABELS: Record<ValueBase, string> = {
  DOCUMENT_AMOUNT: 'Valor do documento',
  MERCHANDISE_AMOUNT: 'Mercadorias',
  SERVICES_AMOUNT: 'Serviços',
  TOTAL_AMOUNT: 'Valor total',
  FREIGHT_AMOUNT: 'Frete',
  INSURANCE_AMOUNT: 'Seguro',
  DISCOUNT_AMOUNT: 'Desconto',
  OTHER_EXPENSES_AMOUNT: 'Outras despesas',
  ICMS_AMOUNT: 'ICMS',
  IPI_AMOUNT: 'IPI',
  PIS_AMOUNT: 'PIS',
  COFINS_AMOUNT: 'COFINS',
  ISS_AMOUNT: 'ISS'
}

export interface FiscalAccountingRuleLine {
  id?: string
  workspace_id?: string
  company_id?: string
  rule_id?: string
  line_order: number
  debit_credit: DebitCredit
  account_source: AccountSource
  account_id: string | null
  value_base: ValueBase
  amount_multiplier: number | string
  memo_template: string | null
  account?: { code: string; name: string } | null
}

export interface FiscalAccountingRule {
  id: string
  workspace_id: string
  company_id: string
  name: string
  description: string | null
  active: boolean
  priority: number
  document_type: string | null
  document_types: string[] | null
  direction: 'IN' | 'OUT' | null
  directions: Array<'IN' | 'OUT'> | null
  cfop: string | null
  cfops: string[] | null
  cfop_pattern: string | null
  cfop_patterns: string[] | null
  fiscal_operation_nature_id: string | null
  fiscal_operation_nature_ids: string[] | null
  item_type: string | null
  item_types: string[] | null
  partner_id: string | null
  partner_ids: string[] | null
  tax_regime: string | null
  tax_regimes: string[] | null
  min_amount: number | string | null
  max_amount: number | string | null
  debit_account_source: AccountSource
  debit_account_id: string | null
  credit_account_source: AccountSource
  credit_account_id: string | null
  value_base: ValueBase
  description_template: string | null
  auto_suggest: boolean
  auto_generate_draft: boolean
  post_automatically: boolean
  created_at: string
  updated_at: string
  debit_account?: { code: string; name: string } | null
  credit_account?: { code: string; name: string } | null
  fiscal_operation_nature?: { code: string; name: string } | null
  partner?: { name: string } | null
  lines?: FiscalAccountingRuleLine[]
}

export interface FiscalAccountingApplicationLine {
  id: string
  debit_credit: DebitCredit
  account_id: string
  amount: number | string
  memo: string | null
  cost_center_id: string | null
  account?: { code: string; name: string } | null
}

export interface FiscalAccountingApplication {
  id: string
  workspace_id: string
  company_id: string
  fiscal_document_id: string
  journal_entry_id: string | null
  rule_id: string | null
  mode: ApplicationMode
  debit_account_id: string
  credit_account_id: string
  amount: number | string
  description: string | null
  status: ApplicationStatus
  error_message: string | null
  created_by: string | null
  created_at: string
  reversed_at: string | null
  reversal_journal_entry_id: string | null
  debit_account?: { code: string; name: string } | null
  credit_account?: { code: string; name: string } | null
  rule?: { name: string } | null
  journal_entry?: { number: number | null; status: string } | null
  reversal_journal_entry?: { number: number | null; status: string } | null
  lines?: FiscalAccountingApplicationLine[]
}

export interface FiscalAccountingSuggestionLine {
  debitCredit: DebitCredit
  accountId: string
  accountName: string
  amount: number
  valueBase: ValueBase
  amountMultiplier: number
  memo: string
}

export interface FiscalAccountingSuggestion {
  ruleId: string
  ruleName: string
  debitAccountId: string
  debitAccountName: string
  creditAccountId: string
  creditAccountName: string
  amount: number
  description: string
  explanation: string
  warnings: string[]
  lines: FiscalAccountingSuggestionLine[]
  debitTotal: number
  creditTotal: number
}
