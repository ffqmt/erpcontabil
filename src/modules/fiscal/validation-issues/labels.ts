import { PendencyIssueType, PendencySeverity, PendencyStatus, SuggestedAction } from './types'

export const PENDENCY_ISSUE_TYPE_LABELS: Record<PendencyIssueType, string> = {
  ITEM_WITHOUT_PRODUCT: 'Item sem produto vinculado',
  LOW_CONFIDENCE_MATCH: 'Match de item com baixa confiança',
  CFOP_MISSING: 'CFOP ausente',
  CFOP_DIRECTION_MISMATCH: 'CFOP incompatível com a direção',
  NCM_MISSING: 'NCM ausente',
  TAX_SITUATION_CODE_MISSING: 'CST/CSOSN ausente',
  FISCAL_NATURE_MISSING: 'Natureza fiscal ausente',
  PARTNER_MISSING: 'Parceiro ausente',
  NO_ITEMS: 'Documento sem itens',
  NOT_ACCOUNTED: 'Não contabilizado',
  NOT_ASSESSED: 'Não apurado',
  ESTABLISHMENT_MISSING: 'Estabelecimento ausente',
  NFSE_RETENTION_REVIEW: 'NFS-e — revisar retenções',
  CTE_PIS_COFINS_NOT_EXTRACTED: 'CT-e — revisar PIS/COFINS',
  BOOKKEEPING_CFOP_MISSING: 'CFOP de escrituração pendente'
}

export const PENDENCY_SEVERITY_LABELS: Record<PendencySeverity, string> = {
  CRITICAL: 'Crítica',
  WARNING: 'Aviso',
  INFO: 'Informativa'
}

export const PENDENCY_STATUS_LABELS: Record<PendencyStatus, string> = {
  OPEN: 'Aberta',
  RESOLVED: 'Resolvida',
  IGNORED: 'Ignorada'
}

export const SUGGESTED_ACTION_LABELS: Record<SuggestedAction, string> = {
  OPEN_DOCUMENT: 'Abrir documento',
  REVIEW_ITEM: 'Revisar item',
  GO_ACCOUNTING: 'Ir para contabilizar',
  GO_ASSESSMENT: 'Ir para apuração'
}
