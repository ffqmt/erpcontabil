export type TaxType = 'ISS' | 'ICMS' | 'IPI' | 'PIS' | 'COFINS' | 'SIMPLES' | 'INSS_RETIDO' | 'IRRF' | 'PCC' | 'IRPJ' | 'CSLL' | 'OTHER'
export type TaxAssessmentStatus = 'DRAFT' | 'CALCULATED' | 'REVIEWED' | 'CLOSED' | 'CANCELLED'
export type TaxAssessmentLineType = 'DEBIT' | 'CREDIT' | 'RETENTION' | 'ADJUSTMENT_POSITIVE' | 'ADJUSTMENT_NEGATIVE' | 'BALANCE'
export type TaxAssessmentLineSourceType = 'FISCAL_DOCUMENT' | 'FISCAL_ITEM' | 'MANUAL_ADJUSTMENT' | 'RETENTION' | 'PREVIOUS_BALANCE'

export interface TaxAssessmentLine {
  id: string
  tax_assessment_id: string
  fiscal_document_id: string | null
  source_type: string | null
  source_id: string | null
  line_type: string | null
  description: string | null
  base_amount: number | string | null
  tax_rate: number | string | null
  amount: number | string | null
  notes: string | null
}

export interface TaxAssessmentLinesSummary {
  debitTotal: number
  creditTotal: number
  retentionTotal: number
  adjustmentPositiveTotal: number
  adjustmentNegativeTotal: number
  automaticLines: TaxAssessmentLine[]
  manualLines: TaxAssessmentLine[]
}

export interface TaxAssessmentAdjustment {
  id: string
  assessment_id: string
  tax_type: 'IRPJ' | 'CSLL'
  adjustment_type: 'ADDITION' | 'EXCLUSION' | 'COMPENSATION'
  description: string
  amount: number | string
  created_at: string
}

export interface TaxAssessment {
  id: string
  workspace_id: string
  company_id: string
  tax_type: TaxType
  regime: string | null
  competence: string
  base_amount: number | string | null
  rate: number | string | null
  debit_amount: number | string
  credit_amount: number | string
  retained_amount: number | string
  adjustment_amount: number | string
  fine_amount: number | string
  interest_amount: number | string
  payable_amount: number | string
  previous_balance_amount: number | string
  next_balance_amount: number | string
  due_date: string | null
  obligation_id: string | null
  status: TaxAssessmentStatus
  journal_entry_id: string | null
  calculation_memory: any
  reviewed_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  lines?: TaxAssessmentLine[]
  linesSummary?: TaxAssessmentLinesSummary
  adjustments?: TaxAssessmentAdjustment[]
  journal_entry?: { number: number | null; status: string } | null
}
