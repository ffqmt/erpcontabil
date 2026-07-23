export type RegimeRateTaxType = 'IRPJ' | 'CSLL' | 'SIMPLES'

export interface TaxRegimeRate {
  id: string
  workspace_id: string
  company_id: string
  tax_regime: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'
  tax_type: RegimeRateTaxType
  fiscal_operation_nature_id: string | null
  presumption_rate: number | string | null
  tax_rate: number | string
  additional_rate: number | string | null
  additional_threshold_monthly: number | string | null
  valid_from: string
  valid_until: string | null
  active: boolean
  created_at: string
  updated_at: string
  fiscal_operation_nature?: { code: string; name: string } | null
}
