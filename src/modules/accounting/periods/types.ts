export type PeriodStatus = 'OPEN' | 'IN_REVIEW' | 'CLOSED' | 'REOPENED'

export interface AccountingPeriod {
  id: string
  workspace_id: string
  company_id: string
  competence: string      // data (YYYY-MM-DD)
  start_date: string      // data (YYYY-MM-DD)
  end_date: string        // data (YYYY-MM-DD)
  status: PeriodStatus
  closed_by: string | null
  closed_at: string | null
  reopened_by: string | null
  reopened_at: string | null
  reopen_reason: string | null
  created_at: string
  updated_at: string
  
  // Agregações úteis para a tabela
  posted_count?: number
  draft_count?: number
  total_debits?: number
  total_credits?: number
}
