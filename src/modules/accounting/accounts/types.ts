export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'REVENUE_DEDUCTION'
  | 'COST'
  | 'EXPENSE'

export type NormalBalance = 'DEBIT' | 'CREDIT'

export interface ChartAccount {
  id: string
  workspace_id: string
  company_id: string
  parent_id: string | null
  code: string
  name: string
  account_type: AccountType
  normal_balance: NormalBalance
  level: number
  is_synthetic: boolean
  accepts_entries: boolean
  non_entry_reason: string | null
  is_active: boolean
  dre_group: string | null
  bp_group: string | null
  order_dre: number | null
  order_bp: number | null
  default_cost_center_id: string | null
  created_at: string
  updated_at: string
}

export interface AccountTreeNode extends ChartAccount {
  children: AccountTreeNode[]
}
