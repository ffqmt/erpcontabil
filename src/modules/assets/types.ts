export type AssetStatus = 'DRAFT' | 'ACTIVE' | 'FULLY_DEPRECIATED' | 'DISPOSED' | 'SOLD' | 'INACTIVE'
export type AssetDepreciationStatus = 'CALCULATED' | 'POSTED' | 'CANCELLED'

export interface AssetCategory {
  id: string
  workspace_id: string
  company_id: string
  name: string
  description: string | null
  default_useful_life_months: number
  default_annual_rate: number | string | null
  default_asset_account_id: string | null
  default_depreciation_account_id: string | null
  default_expense_account_id: string | null
  disposal_gain_account_id: string | null
  disposal_loss_account_id: string | null
  depreciation_start_rule: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface FixedAsset {
  id: string
  workspace_id: string
  company_id: string
  category_id: string
  code: string | null
  description: string
  asset_tag: string | null
  acquisition_date: string
  start_depreciation_date: string | null
  acquisition_amount: number | string
  residual_amount: number | string
  useful_life_months: number
  fiscal_document_id: string | null
  fiscal_document_item_id: string | null
  partner_id: string | null
  asset_account_id: string
  depreciation_account_id: string
  expense_account_id: string
  cost_center_id: string | null
  status: AssetStatus
  acquisition_journal_entry_id: string | null
  disposal_date: string | null
  disposal_amount: number | string | null
  disposal_reason: string | null
  disposal_journal_entry_id: string | null
  created_at: string
  updated_at: string
  category?: AssetCategory | null
  accumulated_depreciation?: number
  net_book_value?: number
}

export interface AssetDepreciation {
  id: string
  fixed_asset_id: string
  competence: string
  accounting_amount: number | string
  fiscal_amount: number | string | null
  status: AssetDepreciationStatus
  depreciation_date: string | null
  accumulated_amount_after: number | string | null
  net_book_value_after: number | string | null
  journal_entry_id: string | null
  notes: string | null
  fixed_asset?: { code: string | null; description: string } | null
}

export interface AssetsDashboardData {
  activeCount: number
  fullyDepreciatedCount: number
  disposedCount: number
  totalAcquisitionValue: number
  totalNetBookValue: number
  pendingDepreciationsCount: number
}
