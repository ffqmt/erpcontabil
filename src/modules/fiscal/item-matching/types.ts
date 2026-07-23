export type ReviewIssueType = 'ITEM_WITHOUT_PRODUCT' | 'LOW_CONFIDENCE_MATCH'
export type ReviewIssueSeverity = 'INFO' | 'WARNING' | 'BLOCKING'
export type ReviewIssueStatus = 'OPEN' | 'RESOLVED' | 'IGNORED'

export interface FiscalDocumentItemReviewIssue {
  id: string
  company_id: string
  fiscal_document_id: string
  fiscal_document_item_id: string
  issue_type: ReviewIssueType
  severity: ReviewIssueSeverity
  status: ReviewIssueStatus
  suggested_item_id: string | null
  details: { supplierProductCode?: string | null; partnerId?: string | null } | null
  created_at: string
  resolved_at: string | null
  // Campos derivados via join (queries.ts) — não existem na tabela.
  fiscal_document?: { id: string; number: string | null } | null
  fiscal_document_item?: { id: string; description: string; ncm: string | null; unit: string | null; total_amount: number | string } | null
  partner?: { id: string; name: string } | null
}
