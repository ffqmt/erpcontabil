import { z } from 'zod'

const assetCategoryFields = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres.').max(200),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  defaultUsefulLifeMonths: z.number().int().min(1, 'Vida útil deve ser maior que zero.'),
  defaultAnnualRate: z.number().min(0).optional(),
  defaultAssetAccountId: z.string().guid().optional().or(z.literal('')),
  defaultDepreciationAccountId: z.string().guid().optional().or(z.literal('')),
  defaultExpenseAccountId: z.string().guid().optional().or(z.literal('')),
  disposalGainAccountId: z.string().guid().optional().or(z.literal('')),
  disposalLossAccountId: z.string().guid().optional().or(z.literal(''))
})

export const createAssetCategorySchema = assetCategoryFields
export const updateAssetCategorySchema = assetCategoryFields.extend({ id: z.string().guid('ID de categoria inválido.') })

export const toggleAssetCategoryActiveSchema = z.object({
  id: z.string().guid('ID de categoria inválido.'),
  active: z.boolean()
})

const fixedAssetFields = z.object({
  categoryId: z.string().guid('Selecione a categoria patrimonial.'),
  code: z.string().trim().max(30).optional().or(z.literal('')),
  description: z.string().trim().min(2, 'Descrição deve ter pelo menos 2 caracteres.').max(300),
  assetTag: z.string().trim().max(30).optional().or(z.literal('')),
  acquisitionDate: z.string().min(1, 'Informe a data de aquisição.'),
  startDepreciationDate: z.string().optional().or(z.literal('')),
  acquisitionAmount: z.number().min(0.01, 'O valor de aquisição deve ser maior que zero.'),
  residualAmount: z.number().min(0).default(0),
  usefulLifeMonths: z.number().int().min(1, 'Vida útil deve ser maior que zero.'),
  fiscalDocumentId: z.string().guid().optional().or(z.literal('')),
  partnerId: z.string().guid().optional().or(z.literal('')),
  assetAccountId: z.string().guid('Selecione a conta contábil do ativo.'),
  depreciationAccountId: z.string().guid('Selecione a conta de depreciação acumulada.'),
  expenseAccountId: z.string().guid('Selecione a conta de despesa de depreciação.'),
  costCenterId: z.string().guid().optional().or(z.literal(''))
}).refine((data) => data.residualAmount < data.acquisitionAmount, {
  message: 'O valor residual deve ser menor que o valor de aquisição.',
  path: ['residualAmount']
})

export const createFixedAssetSchema = fixedAssetFields
export const updateFixedAssetSchema = z.object({ id: z.string().guid('ID de bem inválido.') }).and(fixedAssetFields)

export const fixedAssetIdSchema = z.object({ id: z.string().guid('ID de bem inválido.') })

/**
 * Etapa 33A — criação de bem a partir de um item de documento fiscal classificado como
 * ASSET. Deliberadamente NÃO aceita descrição/valor/data/parceiro/contas do client — tudo
 * isso é derivado no servidor a partir do item + documento + categoria, para não permitir
 * que o valor do bem divirja do valor real do item fiscal.
 */
export const createFixedAssetFromFiscalItemSchema = z.object({
  fiscalDocumentItemId: z.string().guid('Selecione o item fiscal.'),
  categoryId: z.string().guid('Selecione a categoria patrimonial.'),
  code: z.string().trim().max(30).optional().or(z.literal('')),
  assetTag: z.string().trim().max(30).optional().or(z.literal('')),
  usefulLifeMonths: z.number().int().min(1).optional(),
  residualAmount: z.number().min(0).optional(),
  costCenterId: z.string().guid().optional().or(z.literal(''))
})

export const disposeFixedAssetSchema = z.object({
  id: z.string().guid('ID de bem inválido.'),
  disposalDate: z.string().min(1, 'Informe a data de baixa.'),
  disposalAmount: z.number().min(0).optional(),
  disposalCounterpartAccountId: z.string().guid().optional().or(z.literal('')),
  disposalReason: z.string().trim().min(3, 'Informe o motivo da baixa.').max(500)
})

export const generateAssetDepreciationsSchema = z.object({
  competence: z.string().min(1, 'Informe a competência.')
})

export const postAssetDepreciationSchema = z.object({
  id: z.string().guid('ID de depreciação inválido.')
})

export type CreateAssetCategoryInput = z.infer<typeof createAssetCategorySchema>
export type UpdateAssetCategoryInput = z.infer<typeof updateAssetCategorySchema>
export type CreateFixedAssetInput = z.infer<typeof createFixedAssetSchema>
export type CreateFixedAssetFromFiscalItemInput = z.infer<typeof createFixedAssetFromFiscalItemSchema>
export type DisposeFixedAssetInput = z.infer<typeof disposeFixedAssetSchema>
export type GenerateAssetDepreciationsInput = z.infer<typeof generateAssetDepreciationsSchema>
