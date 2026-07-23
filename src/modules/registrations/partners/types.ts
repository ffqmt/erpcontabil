export type DocumentType = 'CPF' | 'CNPJ'

export interface Partner {
  id: string
  workspace_id: string
  company_id: string
  name: string
  legal_name: string | null
  trade_name: string | null
  document: string | null
  document_type: DocumentType | null
  partner_type: string | null // legado (pré-Etapa 15) — ver comentário em types do banco
  email: string | null
  phone: string | null
  state_registration: string | null
  municipal_registration: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  notes: string | null
  is_customer: boolean
  is_supplier: boolean
  is_carrier: boolean
  is_employee: boolean
  active: boolean
  customer_account_id: string | null
  supplier_account_id: string | null
  created_at: string
  updated_at: string
}

export interface PartnerRoleFlags {
  is_customer: boolean
  is_supplier: boolean
  is_carrier: boolean
  is_employee: boolean
}
