export type FiscalNatureDirection = 'INBOUND' | 'OUTBOUND' | 'BOTH'

export type FiscalOperationKind =
  | 'PURCHASE_MERCHANDISE'
  | 'PURCHASE_INPUT'
  | 'PURCHASE_FIXED_ASSET'
  | 'PURCHASE_USE_CONSUMPTION'
  | 'SALE_MERCHANDISE'
  | 'SERVICE_PROVIDED'
  | 'SERVICE_TAKEN'
  | 'RETURN_PURCHASE'
  | 'RETURN_SALE'
  | 'TRANSFER'
  | 'OTHER'

export type FiscalPurpose = 'RESALE' | 'INPUT' | 'FIXED_ASSET' | 'USE_CONSUMPTION' | 'SERVICE' | 'OTHER'
export type IcmsTreatment = 'TAXED' | 'TAXED_REDUCED_BASE' | 'EXEMPT' | 'NOT_TAXED' | 'SUSPENDED' | 'DEFERRED'
export type IcmsStTreatment = 'NONE' | 'RETAINED_BY_ISSUER' | 'COMPANY_CALCULATES'
export type IpiTreatment = 'TAXED' | 'EXEMPT' | 'NOT_TAXED' | 'SUSPENDED'
export type PisCofinsTreatment = 'TAXED' | 'TAXED_WITH_CREDIT' | 'MONOPHASE' | 'SUBSTITUTION' | 'EXEMPT'
export type IssTreatment = 'TAXED_AT_PROVIDER_CITY' | 'TAXED_AT_TAKER_CITY' | 'EXEMPT' | 'IMMUNE' | 'WITH_RETENTION'
export type ExpectedRetentionType = 'ISS' | 'INSS_RETIDO' | 'IRRF' | 'PIS' | 'COFINS' | 'PCC'
export type ItemNatureDefault = 'PRODUCT' | 'SERVICE' | 'FREIGHT' | 'ASSET' | 'OTHER'
export type FiscalDocumentTypeCode = 'NFE' | 'NFCE' | 'NFSE' | 'CTE' | 'CTE_OS' | 'MDFE' | 'MANUAL' | 'OTHER'

export interface FiscalOperationNature {
  id: string
  workspace_id: string
  company_id: string
  code: string
  name: string
  direction: FiscalNatureDirection
  description: string | null
  is_active: boolean
  // Etapa 35B.1-A — motor operacional (ver docs/especificacao-fluxo-fiscal-operacional-35b1.md, Seção 2)
  operation_kind: FiscalOperationKind | null
  applicable_document_types: FiscalDocumentTypeCode[]
  fiscal_purpose: FiscalPurpose | null
  default_bookkeeping_cfop: string | null
  default_tax_situation: string | null
  icms_treatment: IcmsTreatment | null
  icms_st_treatment: IcmsStTreatment | null
  difal_applicable: boolean
  ipi_treatment: IpiTreatment | null
  pis_cofins_treatment: PisCofinsTreatment | null
  iss_treatment: IssTreatment | null
  expected_retentions: ExpectedRetentionType[]
  generates_credit: boolean
  enters_tax_assessment: boolean
  triggers_accounting: boolean
  suggested_accounting_rule_id: string | null
  requires_product: boolean
  requires_ncm: boolean
  item_nature_default: ItemNatureDefault | null
  created_at: string
  updated_at: string
}
