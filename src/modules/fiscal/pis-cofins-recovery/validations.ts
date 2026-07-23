import { z } from 'zod'

export const upsertPisCofinsRecoverySettingsSchema = z.object({
  enabled: z.boolean(),
  pisRate: z.coerce.number().min(0).max(1),
  cofinsRate: z.coerce.number().min(0).max(1),
  notes: z.string().trim().max(300).optional().or(z.literal(''))
}).superRefine((data, ctx) => {
  if (!data.enabled) return
  if (data.pisRate <= 0) {
    ctx.addIssue({ code: 'custom', path: ['pisRate'], message: 'Informe uma alíquota positiva de PIS para habilitar o recálculo.' })
  }
  if (data.cofinsRate <= 0) {
    ctx.addIssue({ code: 'custom', path: ['cofinsRate'], message: 'Informe uma alíquota positiva de COFINS para habilitar o recálculo.' })
  }
})

export type UpsertPisCofinsRecoverySettingsInput = z.infer<typeof upsertPisCofinsRecoverySettingsSchema>
