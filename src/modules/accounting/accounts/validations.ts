import { z } from 'zod'

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'REVENUE_DEDUCTION', 'COST', 'EXPENSE'] as const

const chartAccountFields = z.object({
  code: z.string().trim().min(1, 'Informe o código da conta.').regex(/^[0-9]+(\.[0-9]+)*$/, 'Use o formato numérico com pontos (ex: 1.1.01).').max(30),
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres.').max(200),
  accountType: z.enum(ACCOUNT_TYPES),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  parentId: z.string().guid().optional().or(z.literal('')),
  isSynthetic: z.boolean()
})

export const createChartAccountSchema = chartAccountFields
export const updateChartAccountSchema = chartAccountFields.extend({ id: z.string().guid('ID de conta inválido.') })

export const toggleChartAccountActiveSchema = z.object({
  id: z.string().guid('ID de conta inválido.'),
  active: z.boolean()
})

export type CreateChartAccountInput = z.infer<typeof createChartAccountSchema>
export type UpdateChartAccountInput = z.infer<typeof updateChartAccountSchema>
