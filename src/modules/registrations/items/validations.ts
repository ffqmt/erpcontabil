import { z } from 'zod'

const itemFields = z.object({
  code: z.string().trim().min(1, 'Código é obrigatório.').max(30),
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres.').max(200),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  itemType: z.enum(['PRODUCT', 'SERVICE', 'BOTH']),
  unit: z.string().trim().max(10).optional().or(z.literal('')),
  ncm: z.string().trim().max(20).optional().or(z.literal('')),
  serviceCode: z.string().trim().max(20).optional().or(z.literal('')),
  cest: z.string().trim().max(20).optional().or(z.literal('')),
  gtin: z.string().trim().max(20).optional().or(z.literal('')),
  defaultFiscalOperationNatureId: z.string().guid().optional().or(z.literal('')),
  fiscalItemUsage: z.enum(['RESALE', 'INPUT', 'FIXED_ASSET', 'USE_CONSUMPTION', 'SERVICE', 'OTHER']).optional().or(z.literal(''))
})

export const createItemSchema = itemFields

export const updateItemSchema = itemFields.extend({
  id: z.string().guid('ID de item inválido.')
})

export const toggleItemActiveSchema = z.object({
  id: z.string().guid('ID de item inválido.'),
  active: z.boolean()
})

export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
export type ToggleItemActiveInput = z.infer<typeof toggleItemActiveSchema>
