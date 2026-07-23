export interface NcmCode {
  id: string
  code: string
  description: string
  active: boolean
}

export interface CestCode {
  id: string
  code: string
  ncm_code: string | null
  segment: string | null
  description: string
  active: boolean
}

export interface CfopCode {
  id: string
  code: string
  description: string
  direction: 'IN' | 'OUT' | null
  operation_scope: string | null
  active: boolean
}

export type TaxSituationFamily = 'ICMS' | 'CSOSN' | 'IPI' | 'PIS' | 'COFINS'

export interface TaxSituationCode {
  id: string
  tax_family: TaxSituationFamily
  code: string
  description: string
  regime: string | null
  credit_allowed: boolean | null
  active: boolean
}

export interface MunicipalServiceCode {
  id: string
  municipality_code: string | null
  national_service_code: string | null
  municipal_service_code: string
  description: string
  active: boolean
}
