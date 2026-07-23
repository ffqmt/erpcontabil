export interface PisCofinsRecoverySettings {
  id: string
  company_id: string
  enabled: boolean
  pis_rate: number | string
  cofins_rate: number | string
  notes: string | null
  updated_at: string
}
