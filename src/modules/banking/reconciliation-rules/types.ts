export type ReconciliationRuleDirection = 'CREDIT' | 'DEBIT' | 'ANY'

export interface ReconciliationRule {
  id: string
  workspace_id: string
  company_id: string
  name: string
  keyword: string
  direction: ReconciliationRuleDirection
  counterparty_account_id: string
  partner_id: string | null
  cost_center_id: string | null
  description_template: string | null
  priority: number
  active: boolean
  created_at: string
  updated_at: string
  counterparty_account?: { code: string; name: string } | null
  partner?: { name: string } | null
}

export const DIRECTION_LABELS: Record<ReconciliationRuleDirection, string> = {
  CREDIT: 'Entrada (crédito)',
  DEBIT: 'Saída (débito)',
  ANY: 'Qualquer sentido'
}
