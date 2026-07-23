import { z } from 'zod'

const fiscalDocumentFields = z.object({
  partnerId: z.string().guid('Selecione um parceiro.'),
  fiscalOperationNatureId: z.string().guid().optional().or(z.literal('')),
  direction: z.enum(['IN', 'OUT']),
  documentType: z.enum(['NFE', 'NFCE', 'NFSE', 'CTE', 'CTE_OS', 'MDFE', 'MANUAL', 'OTHER']),
  operationType: z.enum(['PURCHASE', 'SALE', 'SERVICE_TAKEN', 'SERVICE_PROVIDED', 'FREIGHT', 'RETURN', 'TRANSFER', 'OTHER']).optional(),
  documentNumber: z.string().trim().max(30).optional().or(z.literal('')),
  series: z.string().trim().max(10).optional().or(z.literal('')),
  accessKey: z.string().trim().max(60).optional().or(z.literal('')),
  issueDate: z.string().min(1, 'Informe a data de emissão.'),
  operationDate: z.string().min(1, 'Informe a data de operação (entrada/saída).'),
  documentAmount: z.number().min(0.01, 'O valor total deve ser maior que zero.'),
  merchandiseAmount: z.number().min(0).optional(),
  servicesAmount: z.number().min(0).optional(),
  freightAmount: z.number().min(0).optional(),
  insuranceAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  otherExpensesAmount: z.number().min(0).optional(),
  icmsBase: z.number().min(0).optional(),
  icmsRate: z.number().min(0).optional(),
  icmsAmount: z.number().min(0).optional(),
  issBase: z.number().min(0).optional(),
  issRate: z.number().min(0).optional(),
  issAmount: z.number().min(0).optional(),
  pisBase: z.number().min(0).optional(),
  pisRate: z.number().min(0).optional(),
  pisAmount: z.number().min(0).optional(),
  cofinsBase: z.number().min(0).optional(),
  cofinsRate: z.number().min(0).optional(),
  cofinsAmount: z.number().min(0).optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal(''))
})

export const createFiscalDocumentSchema = fiscalDocumentFields
export const updateFiscalDocumentSchema = fiscalDocumentFields.extend({
  id: z.string().guid('ID de documento fiscal inválido.')
})

export const fiscalDocumentIdSchema = z.object({
  id: z.string().guid('ID de documento fiscal inválido.')
})

export const bulkFiscalDocumentWorkflowSchema = z.object({
  ids: z.array(z.string().guid('ID de documento fiscal inválido.')).min(1, 'Selecione pelo menos um documento.').max(5000, 'Selecione no máximo 5000 documentos por lote.'),
  operation: z.enum(['VALIDATE', 'BOOK'])
})

export const bulkFiscalDocumentAccountingSchema = z.object({
  ids: z.array(z.string().guid('ID de documento fiscal inválido.')).min(1, 'Selecione pelo menos um documento.').max(5000, 'Selecione no máximo 5000 documentos por lote.')
})

export const cancelFiscalDocumentSchema = z.object({
  id: z.string().guid('ID de documento fiscal inválido.'),
  reason: z.string().trim().min(3, 'Informe uma justificativa para o cancelamento.').max(500)
})

const fiscalDocumentItemFields = z.object({
  fiscalDocumentId: z.string().guid(),
  itemId: z.string().guid().optional().or(z.literal('')),
  lineNumber: z.number().int().min(1).optional(),
  description: z.string().trim().min(1, 'Descrição obrigatória.').max(300),
  itemType: z.enum(['PRODUCT', 'SERVICE', 'FREIGHT', 'ASSET', 'OTHER']),
  quantity: z.number().min(0.0001, 'Quantidade deve ser maior que zero.'),
  unit: z.string().trim().max(10).optional().or(z.literal('')),
  unitPrice: z.number().min(0).optional(),
  totalAmount: z.number().min(0.01, 'O total do item deve ser maior que zero.'),
  ncm: z.string().trim().max(20).optional().or(z.literal('')),
  cfop: z.string().trim().max(10).optional().or(z.literal('')),
  serviceCode: z.string().trim().max(20).optional().or(z.literal('')),
  icmsAmount: z.number().min(0).optional(),
  ipiAmount: z.number().min(0).optional(),
  pisAmount: z.number().min(0).optional(),
  cofinsAmount: z.number().min(0).optional(),
  issAmount: z.number().min(0).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal(''))
})

export const createFiscalDocumentItemSchema = fiscalDocumentItemFields
export const updateFiscalDocumentItemSchema = fiscalDocumentItemFields.extend({
  id: z.string().guid('ID de item inválido.')
})

export const deleteFiscalDocumentItemSchema = z.object({
  id: z.string().guid('ID de item inválido.'),
  fiscalDocumentId: z.string().guid()
})

const retentionEntry = z.object({
  taxType: z.enum(['ISS', 'ICMS', 'IPI', 'PIS', 'COFINS', 'SIMPLES', 'INSS_RETIDO', 'IRRF', 'PCC', 'OTHER']),
  baseAmount: z.number().min(0),
  rate: z.number().min(0).optional(),
  amount: z.number().min(0.01, 'O valor retido deve ser maior que zero.'),
  withheldByPartner: z.boolean().default(true),
  notes: z.string().trim().max(300).optional().or(z.literal(''))
})

export const upsertFiscalDocumentRetentionsSchema = z.object({
  fiscalDocumentId: z.string().guid(),
  retentions: z.array(retentionEntry).max(20)
})

export const accountFiscalDocumentSchema = z
  .object({
    id: z.string().guid('ID de documento fiscal inválido.'),
    ruleId: z.string().guid().optional().or(z.literal('')),
    debitAccountId: z.string().guid().optional().or(z.literal('')),
    creditAccountId: z.string().guid().optional().or(z.literal('')),
    costCenterId: z.string().guid().optional().or(z.literal(''))
  })
  .superRefine((data, ctx) => {
    if (!data.ruleId) {
      if (!data.debitAccountId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione a conta de débito.', path: ['debitAccountId'] })
      if (!data.creditAccountId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione a conta de crédito.', path: ['creditAccountId'] })
    }
  })

export const reverseFiscalDocumentAccountingSchema = z.object({
  id: z.string().guid('ID de documento fiscal inválido.'),
  reason: z.string().trim().min(3, 'Informe o motivo do estorno.').max(500)
})

export const regenerateFiscalDocumentAccountingSchema = z
  .object({
    id: z.string().guid('ID de documento fiscal inválido.'),
    reason: z.string().trim().min(3, 'Informe o motivo da regeração.').max(500),
    ruleId: z.string().guid().optional().or(z.literal('')),
    debitAccountId: z.string().guid().optional().or(z.literal('')),
    creditAccountId: z.string().guid().optional().or(z.literal('')),
    costCenterId: z.string().guid().optional().or(z.literal(''))
  })
  .superRefine((data, ctx) => {
    if (!data.ruleId) {
      if (!data.debitAccountId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione a conta de débito.', path: ['debitAccountId'] })
      if (!data.creditAccountId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione a conta de crédito.', path: ['creditAccountId'] })
    }
  })

export type CreateFiscalDocumentInput = z.infer<typeof createFiscalDocumentSchema>
export type UpdateFiscalDocumentInput = z.infer<typeof updateFiscalDocumentSchema>
export type CreateFiscalDocumentItemInput = z.infer<typeof createFiscalDocumentItemSchema>
export type UpdateFiscalDocumentItemInput = z.infer<typeof updateFiscalDocumentItemSchema>
export type UpsertFiscalDocumentRetentionsInput = z.infer<typeof upsertFiscalDocumentRetentionsSchema>
export type AccountFiscalDocumentInput = z.infer<typeof accountFiscalDocumentSchema>
