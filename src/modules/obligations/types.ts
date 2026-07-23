export type ObligationDocumentType =
  | 'DAS' | 'ISS' | 'ICMS' | 'IPI' | 'PIS_COFINS' | 'IRPJ_CSLL' | 'DCTFWEB' | 'FGTS_DIGITAL'
  | 'EFD_CONTRIBUICOES' | 'EFD_ICMS_IPI' | 'ECD' | 'ECF' | 'DEFIS'
  | 'PIS' | 'COFINS' | 'IRPJ' | 'CSLL' | 'FGTS' | 'INSS' | 'OTHER'

export type ObligationWorkflowStatus = 'OPEN' | 'GENERATED' | 'PAID' | 'DELIVERED' | 'OVERDUE' | 'CANCELLED'

export interface Obligation {
  id: string
  workspace_id: string
  company_id: string
  obligation_type: ObligationDocumentType
  competence: string
  amount: number | string
  due_date: string
  status: ObligationWorkflowStatus
  origin_assessment_id: string | null
  origin_assessment_table: string | null
  provision_journal_entry_id: string | null
  payment_journal_entry_id: string | null
  barcode: string | null
  payment_code: string | null
  document_url: string | null
  paid_at: string | null
  delivered_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  payment_journal_entry?: { number: number | null; status: string } | null
}

export interface ObligationsDashboardData {
  openCount: number
  overdueCount: number
  dueSoonCount: number
  paidOrDeliveredThisMonthCount: number
  openAmountTotal: number
}
