import { z } from 'zod'
import { ASSESSABLE_TAX_TYPE_VALUES } from './options'

export const updateCompanyTaxAssessmentSettingsSchema = z.object({
  settings: z.array(z.object({
    taxType: z.enum(ASSESSABLE_TAX_TYPE_VALUES),
    enabled: z.boolean(),
    accountAssessment: z.boolean(),
    calculationMode: z.enum(['AUTO', 'MANUAL'])
  })).min(1)
})

export type UpdateCompanyTaxAssessmentSettingsInput = z.infer<typeof updateCompanyTaxAssessmentSettingsSchema>
