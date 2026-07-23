export type { ParsedNfeItem, ParsedNfeResult } from './nfe-parser'

export type PartnerRole = 'SUPPLIER' | 'CUSTOMER'

export interface PartnerResolutionPreview {
  status: 'FOUND' | 'WILL_CREATE'
  partnerId: string | null
  name: string
  documentNormalized: string | null
  role: PartnerRole
  hasLinkedAccount: boolean
}

export interface FiscalXmlPreview {
  xmlImportId: string
  parsed: import('./nfe-parser').ParsedNfeResult
  documentType: 'NFE' | 'CTE' | 'NFSE'
  direction: 'IN' | 'OUT' | null
  partner: PartnerResolutionPreview
  duplicateOfFiscalDocumentId: string | null
  companyCnpjMismatch: boolean
  blockingErrors: string[]
}

export interface BulkImportResultItem {
  fileName: string
  status: 'IMPORTED' | 'BLOCKED' | 'ERROR'
  fiscalDocumentId?: string
  reasons?: string[]
  supplierName?: string | null
  documentAmount?: number | null
}

export interface FiscalXmlImportRow {
  id: string
  workspace_id: string
  company_id: string
  fiscal_document_id: string | null
  file_name: string | null
  access_key: string | null
  import_hash: string | null
  import_status: 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED' | 'DUPLICATE' | 'ERROR'
  parse_errors: unknown
  parsed_preview: unknown
  created_at: string
  updated_at: string
}
