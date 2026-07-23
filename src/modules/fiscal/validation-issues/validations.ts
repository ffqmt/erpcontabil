import { z } from 'zod'

export const validationIssueTypeSchema = z.enum([
  'CFOP_MISSING',
  'CFOP_DIRECTION_MISMATCH',
  'NCM_MISSING',
  'TAX_SITUATION_CODE_MISSING',
  'FISCAL_NATURE_MISSING',
  'PARTNER_MISSING',
  'NO_ITEMS',
  'NOT_ACCOUNTED',
  'NOT_ASSESSED',
  'ESTABLISHMENT_MISSING',
  'NFSE_RETENTION_REVIEW',
  'CTE_PIS_COFINS_NOT_EXTRACTED',
  'BOOKKEEPING_CFOP_MISSING'
])

export const setValidationIssueStatusSchema = z.object({
  fiscalDocumentId: z.string().uuid(),
  fiscalDocumentItemId: z.string().uuid().nullable().optional(),
  issueType: validationIssueTypeSchema,
  severity: z.enum(['CRITICAL', 'WARNING', 'INFO']),
  message: z.string().min(1).max(500)
})
