import { z } from 'zod'

export const periodIdSchema = z.object({
  periodId: z.string().guid('ID de período contábil inválido.')
})

export const closeAccountingPeriodSchema = periodIdSchema

export const reopenAccountingPeriodSchema = periodIdSchema.extend({
  reason: z.string().trim().min(10, 'Informe o motivo da reabertura com pelo menos 10 caracteres.').max(500)
})

export type ClosePeriodInput = z.infer<typeof closeAccountingPeriodSchema>
export type ReopenPeriodInput = z.infer<typeof reopenAccountingPeriodSchema>
export type PeriodIdInput = z.infer<typeof periodIdSchema>
