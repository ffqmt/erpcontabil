import { z } from 'zod'

const ruleFields = z.object({
  name: z.string().trim().min(2, 'Nome da regra deve ter pelo menos 2 caracteres.').max(200),
  keyword: z.string().trim().min(2, 'Palavra-chave deve ter pelo menos 2 caracteres.').max(200),
  direction: z.enum(['CREDIT', 'DEBIT', 'ANY']).default('ANY'),
  counterpartyAccountId: z.string().guid('Selecione a conta de contrapartida sugerida.'),
  partnerId: z.string().guid('ID de parceiro inválido.').optional().or(z.literal('')),
  costCenterId: z.string().guid('ID de centro de custo inválido.').optional().or(z.literal('')),
  descriptionTemplate: z.string().trim().max(300).optional().or(z.literal('')),
  priority: z.coerce.number().int().min(1).max(999).default(100)
})

export const createReconciliationRuleSchema = ruleFields

export const updateReconciliationRuleSchema = ruleFields.extend({
  id: z.string().guid('ID de regra inválido.')
})

export const toggleReconciliationRuleActiveSchema = z.object({
  id: z.string().guid('ID de regra inválido.'),
  active: z.boolean()
})

export const deleteReconciliationRuleSchema = z.object({
  id: z.string().guid('ID de regra inválido.')
})

export const applyReconciliationRuleSchema = z.object({
  lineId: z.string().guid('ID de linha de extrato inválido.')
})

export type CreateReconciliationRuleInput = z.infer<typeof createReconciliationRuleSchema>
export type UpdateReconciliationRuleInput = z.infer<typeof updateReconciliationRuleSchema>
