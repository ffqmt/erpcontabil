import { z } from 'zod'

const accountSourceEnum = z.enum(['FIXED', 'PARTNER_CUSTOMER', 'PARTNER_SUPPLIER'])
const debitCreditEnum = z.enum(['DEBIT', 'CREDIT'])
const postgresUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const postgresUuid = z.string().trim().regex(postgresUuidPattern, 'UUID inválido.')
const positiveNumber = z.coerce.number().positive('O valor deve ser maior que zero.')
const optionalNonNegativeNumber = z.preprocess(
  (value) => (value === '' || value === null || (typeof value === 'number' && Number.isNaN(value)) ? undefined : value),
  z.coerce.number().min(0).optional()
)
const valueBaseEnum = z.enum([
  'DOCUMENT_AMOUNT',
  'MERCHANDISE_AMOUNT',
  'SERVICES_AMOUNT',
  'TOTAL_AMOUNT',
  'FREIGHT_AMOUNT',
  'INSURANCE_AMOUNT',
  'DISCOUNT_AMOUNT',
  'OTHER_EXPENSES_AMOUNT',
  'ICMS_AMOUNT',
  'IPI_AMOUNT',
  'PIS_AMOUNT',
  'COFINS_AMOUNT',
  'ISS_AMOUNT'
])

const ruleLineSchema = z.object({
  debitCredit: debitCreditEnum,
  accountSource: accountSourceEnum,
  accountId: postgresUuid.optional().or(z.literal('')),
  valueBase: valueBaseEnum,
  amountMultiplier: positiveNumber.max(999, 'O multiplicador deve ser no máximo 999.'),
  memoTemplate: z.string().trim().max(300).optional().or(z.literal(''))
})

const stringList = (maxItemLength: number, maxItems: number) =>
  z.array(z.string().trim().min(1).max(maxItemLength)).max(maxItems).optional().default([])

const uuidList = z.array(postgresUuid).max(100).optional().default([])

const baseRuleFields = {
  name: z.string().trim().min(1, 'Informe um nome para a regra.').max(150),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  priority: z.coerce.number().int().min(1).max(999),
  documentType: z.string().trim().max(20).optional().or(z.literal('')),
  documentTypes: stringList(20, 20),
  direction: z.enum(['IN', 'OUT']).optional().or(z.literal('')),
  directions: z.array(z.enum(['IN', 'OUT'])).max(2).optional().default([]),
  cfop: z.string().trim().max(10).optional().or(z.literal('')),
  cfops: stringList(10, 80),
  cfopPattern: z.string().trim().max(20).optional().or(z.literal('')),
  cfopPatterns: stringList(20, 80),
  fiscalOperationNatureId: postgresUuid.optional().or(z.literal('')),
  fiscalOperationNatureIds: uuidList,
  itemType: z.string().trim().max(20).optional().or(z.literal('')),
  itemTypes: stringList(20, 20),
  partnerId: postgresUuid.optional().or(z.literal('')),
  partnerIds: uuidList,
  taxRegime: z.string().trim().max(30).optional().or(z.literal('')),
  taxRegimes: stringList(30, 20),
  minAmount: optionalNonNegativeNumber,
  maxAmount: optionalNonNegativeNumber,
  descriptionTemplate: z.string().trim().max(300).optional().or(z.literal('')),
  lines: z.array(ruleLineSchema).min(2, 'Inclua pelo menos uma partida de débito e uma de crédito.').max(40)
}

function refineRuleLines<T extends { lines: Array<{ debitCredit: string; accountSource: string; accountId?: string }> }>(data: T, ctx: z.RefinementCtx) {
  const hasDebit = data.lines.some((line) => line.debitCredit === 'DEBIT')
  const hasCredit = data.lines.some((line) => line.debitCredit === 'CREDIT')

  if (!hasDebit) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Inclua pelo menos uma partida de débito.', path: ['lines'] })
  }
  if (!hasCredit) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Inclua pelo menos uma partida de crédito.', path: ['lines'] })
  }

  data.lines.forEach((line, index) => {
    if (line.accountSource === 'FIXED' && !line.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Conta fixa é obrigatória quando a origem é FIXED.',
        path: ['lines', index, 'accountId']
      })
    }
  })

  if (data.lines.length > 0) {
    const firstDebit = data.lines.find((line) => line.debitCredit === 'DEBIT')
    const firstCredit = data.lines.find((line) => line.debitCredit === 'CREDIT')
    if (firstDebit?.accountSource === 'FIXED' && firstCredit?.accountSource === 'FIXED' && firstDebit.accountId && firstDebit.accountId === firstCredit.accountId && data.lines.length === 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A conta de débito não pode ser igual à conta de crédito em uma regra simples.', path: ['lines'] })
    }
  }
}

export const createFiscalAccountingRuleSchema = z.object(baseRuleFields).superRefine(refineRuleLines)

export const updateFiscalAccountingRuleSchema = z.object({ id: postgresUuid, ...baseRuleFields }).superRefine(refineRuleLines)

export const toggleFiscalAccountingRuleActiveSchema = z.object({
  id: postgresUuid,
  active: z.boolean()
})

export const deleteFiscalAccountingRuleSchema = z.object({
  id: postgresUuid
})

export const duplicateFiscalAccountingRuleSchema = z.object({
  id: postgresUuid
})

export type CreateFiscalAccountingRuleInput = z.infer<typeof createFiscalAccountingRuleSchema>
export type UpdateFiscalAccountingRuleInput = z.infer<typeof updateFiscalAccountingRuleSchema>
