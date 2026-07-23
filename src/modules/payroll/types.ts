export type PayrollAccountingStatus = 'NOT_ACCOUNTED' | 'ACCOUNTED' | 'ACCOUNTING_ERROR'
export type PayrollImportStatus = 'IMPORTED' | 'DUPLICATE' | 'ERROR'
export type PayrollEventItemLineType = 'EARNING' | 'DEDUCTION' | 'INFORMATIVE' | 'UNKNOWN'

export interface PayrollEsocialImport {
  id: string
  workspace_id: string
  company_id: string
  file_name: string | null
  import_hash: string
  event_id: string | null
  event_type: string | null
  import_status: PayrollImportStatus
  xml_raw: string
  parsed_payload: unknown
  parse_errors: unknown
  created_at: string
  updated_at: string
}

export interface PayrollEsocialEventItem {
  id: string
  payroll_event_id: string
  item_order: number
  line_type: PayrollEventItemLineType
  rubric_code: string | null
  rubric_table: string | null
  rubric_nature: string | null
  description: string | null
  reference_value: number | string | null
  quantity: number | string | null
  factor: number | string | null
  amount: number | string
  raw_payload: unknown
}

export interface PayrollEsocialEvent {
  id: string
  workspace_id: string
  company_id: string
  import_id: string | null
  event_id: string | null
  event_type: string
  event_name: string | null
  employer_registration: string | null
  period_competence: string | null
  payment_date: string | null
  worker_cpf: string | null
  worker_name: string | null
  worker_registration: string | null
  worker_category: string | null
  gross_amount: number | string
  deductions_amount: number | string
  net_amount: number | string
  inss_employee_amount: number | string
  irrf_amount: number | string
  fgts_amount: number | string
  employer_inss_amount: number | string
  other_amount: number | string
  accounting_status: PayrollAccountingStatus
  journal_entry_id: string | null
  event_payload: unknown
  created_at: string
  updated_at: string
  import?: Pick<PayrollEsocialImport, 'file_name' | 'created_at'> | null
  items?: PayrollEsocialEventItem[]
}

export interface PayrollDashboardData {
  eventsThisCompetence: number
  notAccountedCount: number
  grossAmount: number
  netAmount: number
  deductionAmount: number
}
