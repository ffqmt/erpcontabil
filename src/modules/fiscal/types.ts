export type FiscalDocumentDirection = 'IN' | 'OUT'
export type FiscalDocumentType = 'NFE' | 'NFCE' | 'NFSE' | 'CTE' | 'CTE_OS' | 'MDFE' | 'MANUAL' | 'OTHER'
export type FiscalOperationType = 'PURCHASE' | 'SALE' | 'SERVICE_TAKEN' | 'SERVICE_PROVIDED' | 'FREIGHT' | 'RETURN' | 'TRANSFER' | 'OTHER'
export type FiscalDocumentStatus = 'DRAFT' | 'IMPORTED' | 'VALIDATED' | 'BOOKED' | 'CANCELLED'
export type FiscalDocumentAccountingStatus = 'NOT_ACCOUNTED' | 'ACCOUNTED' | 'ACCOUNTING_ERROR'
export type FiscalDocumentTaxStatus = 'NOT_ASSESSED' | 'ASSESSED' | 'IGNORED'
export type FiscalItemType = 'PRODUCT' | 'SERVICE' | 'FREIGHT' | 'ASSET' | 'OTHER'
export type TaxType = 'ISS' | 'ICMS' | 'IPI' | 'PIS' | 'COFINS' | 'SIMPLES' | 'INSS_RETIDO' | 'IRRF' | 'PCC' | 'IRPJ' | 'CSLL' | 'OTHER'

export interface FiscalDocumentItem {
  id: string
  fiscal_document_id: string
  item_id: string | null
  line_number: number | null
  description: string
  item_type: FiscalItemType
  quantity: number | string
  unit: string | null
  unit_amount: number | string | null
  total_amount: number | string
  discount_amount: number | string | null
  freight_amount: number | string | null
  ncm: string | null
  cest: string | null
  service_code: string | null
  cfop: string | null
  cst_icms: string | null
  csosn: string | null
  cst_ipi: string | null
  cst_pis: string | null
  cst_cofins: string | null
  tax_base_icms: number | string | null
  icms_rate: number | string | null
  icms_amount: number | string | null
  tax_base_ipi: number | string | null
  ipi_rate: number | string | null
  ipi_amount: number | string | null
  tax_base_pis: number | string | null
  pis_rate: number | string | null
  pis_amount: number | string | null
  tax_base_cofins: number | string | null
  cofins_rate: number | string | null
  cofins_amount: number | string | null
  tax_base_iss: number | string | null
  iss_rate: number | string | null
  iss_amount: number | string | null
  notes: string | null
}

export interface FiscalDocumentRetention {
  id: string
  fiscal_document_id: string
  tax_type: TaxType
  base_amount: number | string
  rate: number | string | null
  amount: number | string
  withheld_by_partner: boolean
  due_date: string | null
  notes: string | null
}

export interface FiscalDocument {
  id: string
  workspace_id: string
  company_id: string
  establishment_id: string | null
  partner_id: string | null
  fiscal_operation_nature_id: string | null
  direction: FiscalDocumentDirection
  document_type: FiscalDocumentType
  operation_type: FiscalOperationType | null
  number: string | null
  series: string | null
  access_key: string | null
  issue_date: string | null
  operation_date: string | null
  competence: string
  due_date: string | null
  document_amount: number | string
  merchandise_amount: number | string | null
  services_amount: number | string | null
  freight_amount: number | string | null
  insurance_amount: number | string | null
  discount_amount: number | string | null
  other_expenses_amount: number | string | null
  icms_base: number | string | null
  icms_rate: number | string | null
  icms_amount: number | string | null
  iss_base: number | string | null
  iss_rate: number | string | null
  iss_amount: number | string | null
  pis_base: number | string | null
  pis_rate: number | string | null
  pis_amount: number | string | null
  cofins_base: number | string | null
  cofins_rate: number | string | null
  cofins_amount: number | string | null
  status: FiscalDocumentStatus
  accounting_status: FiscalDocumentAccountingStatus
  tax_status: FiscalDocumentTaxStatus
  source: string
  journal_entry_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  partner?: { name: string } | null
  fiscal_operation_nature?: { code: string; name: string; direction: string } | null
  journal_entry?: { number: number | null; status: string } | null
  items?: FiscalDocumentItem[]
  retentions?: FiscalDocumentRetention[]
  active_accounting_application_count?: number
  open_pendency_count?: number
  has_no_product_pendency?: boolean
  has_xml_warning_pendency?: boolean
}

export interface FiscalDashboardData {
  documentsThisMonth: number
  draftCount: number
  validatedCount: number
  bookedCount: number
  notAccountedCount: number
  cancelledCount: number
  inboundTotal: number
  outboundTotal: number
}
