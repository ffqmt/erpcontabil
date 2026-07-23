import { z } from 'zod'

const operationKindEnum = z.enum([
  'PURCHASE_MERCHANDISE', 'PURCHASE_INPUT', 'PURCHASE_FIXED_ASSET', 'PURCHASE_USE_CONSUMPTION',
  'SALE_MERCHANDISE', 'SERVICE_PROVIDED', 'SERVICE_TAKEN', 'RETURN_PURCHASE', 'RETURN_SALE',
  'TRANSFER', 'OTHER'
])
const fiscalPurposeEnum = z.enum(['RESALE', 'INPUT', 'FIXED_ASSET', 'USE_CONSUMPTION', 'SERVICE', 'OTHER'])
const icmsTreatmentEnum = z.enum(['TAXED', 'TAXED_REDUCED_BASE', 'EXEMPT', 'NOT_TAXED', 'SUSPENDED', 'DEFERRED'])
const icmsStTreatmentEnum = z.enum(['NONE', 'RETAINED_BY_ISSUER', 'COMPANY_CALCULATES'])
const ipiTreatmentEnum = z.enum(['TAXED', 'EXEMPT', 'NOT_TAXED', 'SUSPENDED'])
const pisCofinsTreatmentEnum = z.enum(['TAXED', 'TAXED_WITH_CREDIT', 'MONOPHASE', 'SUBSTITUTION', 'EXEMPT'])
const issTreatmentEnum = z.enum(['TAXED_AT_PROVIDER_CITY', 'TAXED_AT_TAKER_CITY', 'EXEMPT', 'IMMUNE', 'WITH_RETENTION'])
const expectedRetentionEnum = z.enum(['ISS', 'INSS_RETIDO', 'IRRF', 'PIS', 'COFINS', 'PCC'])
const itemNatureDefaultEnum = z.enum(['PRODUCT', 'SERVICE', 'FREIGHT', 'ASSET', 'OTHER'])
const documentTypeCodeEnum = z.enum(['NFE', 'NFCE', 'NFSE', 'CTE', 'CTE_OS', 'MDFE', 'MANUAL', 'OTHER'])
const postgresUuid = z.string().trim().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'UUID inválido.')

const fiscalNatureFields = z.object({
  code: z.string().trim().min(1, 'Código é obrigatório.').max(30),
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres.').max(200),
  direction: z.enum(['INBOUND', 'OUTBOUND', 'BOTH']),
  description: z.string().trim().max(1000).optional().or(z.literal('')),

  // Etapa 35B.1-A — motor operacional, todos opcionais (fallback = comportamento anterior)
  operationKind: operationKindEnum.optional().or(z.literal('')),
  applicableDocumentTypes: z.array(documentTypeCodeEnum).max(8).optional().default([]),
  fiscalPurpose: fiscalPurposeEnum.optional().or(z.literal('')),
  defaultBookkeepingCfop: z.string().trim().max(10).optional().or(z.literal('')),
  defaultTaxSituation: z.string().trim().max(10).optional().or(z.literal('')),
  icmsTreatment: icmsTreatmentEnum.optional().or(z.literal('')),
  icmsStTreatment: icmsStTreatmentEnum.optional().or(z.literal('')),
  difalApplicable: z.boolean().default(false),
  ipiTreatment: ipiTreatmentEnum.optional().or(z.literal('')),
  pisCofinsTreatment: pisCofinsTreatmentEnum.optional().or(z.literal('')),
  issTreatment: issTreatmentEnum.optional().or(z.literal('')),
  expectedRetentions: z.array(expectedRetentionEnum).max(6).optional().default([]),
  generatesCredit: z.boolean().default(false),
  entersTaxAssessment: z.boolean().default(true),
  triggersAccounting: z.boolean().default(true),
  suggestedAccountingRuleId: postgresUuid.optional().or(z.literal('')),
  requiresProduct: z.boolean().default(false),
  requiresNcm: z.boolean().default(false),
  itemNatureDefault: itemNatureDefaultEnum.optional().or(z.literal(''))
})

export const createFiscalNatureSchema = fiscalNatureFields

export const updateFiscalNatureSchema = fiscalNatureFields.extend({
  id: z.string().guid('ID de natureza fiscal inválido.')
})

export const toggleFiscalNatureActiveSchema = z.object({
  id: z.string().guid('ID de natureza fiscal inválido.'),
  isActive: z.boolean()
})

export const seedDefaultFiscalNaturesSchema = z.object({})

export type CreateFiscalNatureInput = z.infer<typeof createFiscalNatureSchema>
export type UpdateFiscalNatureInput = z.infer<typeof updateFiscalNatureSchema>
export type ToggleFiscalNatureActiveInput = z.infer<typeof toggleFiscalNatureActiveSchema>
