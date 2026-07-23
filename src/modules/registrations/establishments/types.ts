export type EstablishmentType = 'HEADQUARTERS' | 'BRANCH'

export interface Establishment {
  id: string
  workspace_id: string
  company_id: string
  type: EstablishmentType
  code: string | null
  name: string | null
  cnpj: string
  state_registration: string | null
  municipal_registration: string | null
  city: string | null
  state: string | null
  municipality_code: string | null
  address_line: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export const ESTABLISHMENT_TYPE_LABELS: Record<EstablishmentType, string> = {
  HEADQUARTERS: 'Matriz',
  BRANCH: 'Filial'
}
