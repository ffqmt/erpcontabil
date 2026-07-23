export type PendencySeverity = 'CRITICAL' | 'WARNING' | 'INFO'
export type PendencyStatus = 'OPEN' | 'RESOLVED' | 'IGNORED'

// 'ITEM_MATCHING' = vem de fiscal_document_item_review_issues (Etapa 35A, item sem
// produto/match fraco). 'VALIDATION' = calculado dinamicamente pelo motor de regras da
// 35B (rules.ts), com override opcional persistido em fiscal_document_validation_issues.
export type PendencyOrigin = 'ITEM_MATCHING' | 'VALIDATION'

export type ValidationIssueType =
  | 'CFOP_MISSING'
  | 'CFOP_DIRECTION_MISMATCH'
  | 'NCM_MISSING'
  | 'TAX_SITUATION_CODE_MISSING'
  | 'FISCAL_NATURE_MISSING'
  | 'PARTNER_MISSING'
  | 'NO_ITEMS'
  | 'NOT_ACCOUNTED'
  | 'NOT_ASSESSED'
  | 'ESTABLISHMENT_MISSING'
  | 'NFSE_RETENTION_REVIEW'
  | 'CTE_PIS_COFINS_NOT_EXTRACTED'
  | 'BOOKKEEPING_CFOP_MISSING'

export type PendencyIssueType = ValidationIssueType | 'ITEM_WITHOUT_PRODUCT' | 'LOW_CONFIDENCE_MATCH'

export type SuggestedAction = 'OPEN_DOCUMENT' | 'REVIEW_ITEM' | 'GO_ACCOUNTING' | 'GO_ASSESSMENT'

export interface FiscalPendency {
  id: string
  origin: PendencyOrigin
  issueType: PendencyIssueType
  severity: PendencySeverity
  status: PendencyStatus
  message: string
  fiscalDocumentId: string
  fiscalDocumentItemId: string | null
  documentNumber: string | null
  documentType: string
  direction: 'IN' | 'OUT'
  issueDate: string | null
  competence: string | null
  partnerId: string | null
  partnerName: string | null
  documentSource: string
  suggestedAction: SuggestedAction
  createdAt: string | null
  resolvedAt: string | null
}

export interface PendencyCounters {
  critical: number
  warning: number
  info: number
  affectedDocuments: number
}

export interface PendencyFilters {
  competence?: string
  documentType?: string
  direction?: string
  partnerId?: string
  severity?: PendencySeverity
  status?: PendencyStatus
  issueType?: PendencyIssueType
  origin?: 'XML' | 'MANUAL'
  fiscalDocumentId?: string
  fiscalDocumentIds?: string[]
  limit?: number
}
