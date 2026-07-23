export type TaxRegime = 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'
export type CompanyProfile = 'TRANSPORTATION' | 'TRADE' | 'SERVICES' | 'INDUSTRY' | 'OTHER'

export interface Company {
  id: string
  workspace_id: string
  legal_name: string
  trade_name: string | null
  cnpj: string
  state_registration: string | null
  municipal_registration: string | null
  nire: string | null
  incorporation_date: string | null
  tax_regime: TaxRegime
  company_profile: CompanyProfile
  city: string | null
  state: string | null
  account_template_id: string | null
  main_cnae: string | null
  secondary_cnaes: string[]
  active: boolean
  responsible_name: string | null
  responsible_cpf: string | null
  responsible_role: string | null
  responsible_crc: string | null
  created_at: string
  updated_at: string
}

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real'
}

export const COMPANY_PROFILE_LABELS: Record<CompanyProfile, string> = {
  TRANSPORTATION: 'Transporte',
  TRADE: 'Comércio',
  SERVICES: 'Serviços',
  INDUSTRY: 'Indústria',
  OTHER: 'Outro'
}
