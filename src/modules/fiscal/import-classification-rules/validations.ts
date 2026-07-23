import { z } from 'zod'

const postgresUuid = z.string().trim().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'UUID inválido.')
const optionalUuid = postgresUuid.optional().or(z.literal(''))
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))
const optionalAmount = z.preprocess(
  (value) => (value === '' || value === null || (typeof value === 'number' && Number.isNaN(value)) ? undefined : value),
  z.coerce.number().min(0).optional()
)
const expectedRetentionEnum = z.enum(['ISS', 'INSS_RETIDO', 'IRRF', 'PIS', 'COFINS', 'PCC'])
const itemKindEnum = z.enum(['PRODUCT', 'SERVICE', 'FREIGHT', 'ASSET', 'OTHER'])
const itemFiscalUsageEnum = z.enum(['RESALE', 'INPUT', 'FIXED_ASSET', 'USE_CONSUMPTION', 'SERVICE', 'OTHER'])

const ruleFields = z.object({
  name: z.string().trim().min(1, 'Informe um nome para a regra.').max(150),
  description: optionalText(500),
  priority: z.coerce.number().int().min(1).max(999),
  active: z.boolean().default(true),

  // Condições — todas opcionais (nulo = coringa)
  partnerId: optionalUuid,
  issuerCnpj: optionalText(20),
  xmlCfopPattern: optionalText(10),
  ncmPattern: optionalText(10),
  cest: optionalText(10),
  itemId: optionalUuid,
  supplierProductCode: optionalText(60),
  supplierDescriptionPattern: optionalText(200),
  documentType: z.enum(['NFE', 'NFCE', 'NFSE', 'CTE', 'CTE_OS', 'MDFE', 'MANUAL', 'OTHER']).optional().or(z.literal('')),
  direction: z.enum(['IN', 'OUT']).optional().or(z.literal('')),
  originState: z.string().trim().length(2).optional().or(z.literal('')),
  destinationState: z.string().trim().length(2).optional().or(z.literal('')),
  municipalityCode: optionalText(20),
  minAmount: optionalAmount,
  maxAmount: optionalAmount,

  // Ações
  fiscalOperationNatureId: optionalUuid,
  bookkeepingCfop: optionalText(10),
  taxSituationCode: optionalText(10),
  itemFiscalUsage: itemFiscalUsageEnum.optional().or(z.literal('')),
  itemKind: itemKindEnum.optional().or(z.literal('')),
  generatesCredit: z.boolean().optional(),
  expectedRetentions: z.array(expectedRetentionEnum).max(6).optional().default([]),
  createPartnerItemMapping: z.boolean().default(false)
})

function validateRuleFields(data: z.infer<typeof ruleFields>, ctx: z.RefinementCtx) {
  if (data.minAmount !== undefined && data.maxAmount !== undefined && data.minAmount > data.maxAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O valor máximo deve ser maior ou igual ao valor mínimo.',
      path: ['maxAmount']
    })
  }

  if (data.createPartnerItemMapping && !data.itemId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selecione o produto interno que receberá o mapeamento do código do fornecedor.',
      path: ['itemId']
    })
  }
}

export const createImportClassificationRuleSchema = ruleFields.superRefine(validateRuleFields)
export const updateImportClassificationRuleSchema = ruleFields.extend({ id: postgresUuid }).superRefine(validateRuleFields)
export const toggleImportClassificationRuleActiveSchema = z.object({ id: postgresUuid, active: z.boolean() })
export const deleteImportClassificationRuleSchema = z.object({ id: postgresUuid })

export type CreateImportClassificationRuleInput = z.infer<typeof createImportClassificationRuleSchema>
export type UpdateImportClassificationRuleInput = z.infer<typeof updateImportClassificationRuleSchema>
