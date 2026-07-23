import { z } from 'zod'

const rateFields = {
  taxRegime: z.enum(['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL']),
  taxType: z.enum(['IRPJ', 'CSLL', 'SIMPLES']),
  fiscalOperationNatureId: z.string().uuid().optional().or(z.literal('')),
  presumptionRate: z.number().min(0).max(1).optional(),
  taxRate: z.number().min(0).max(1),
  additionalRate: z.number().min(0).max(1).optional(),
  additionalThresholdMonthly: z.number().min(0).optional(),
  validFrom: z.string().min(1, 'Informe a data de vigência inicial.'),
  validUntil: z.string().optional().or(z.literal(''))
}

export const createTaxRegimeRateSchema = z.object(rateFields)
export const updateTaxRegimeRateSchema = z.object({ id: z.string().uuid(), ...rateFields })
export const toggleTaxRegimeRateActiveSchema = z.object({ id: z.string().uuid(), active: z.boolean() })
export const deleteTaxRegimeRateSchema = z.object({ id: z.string().uuid() })

export type CreateTaxRegimeRateInput = z.infer<typeof createTaxRegimeRateSchema>
