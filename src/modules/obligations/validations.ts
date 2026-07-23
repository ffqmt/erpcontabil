import { z } from 'zod'

export const createObligationSchema = z.object({
  obligationType: z.string().min(1, 'Selecione o tipo de obrigação.'),
  competence: z.string().min(1, 'Informe a competência.'),
  amount: z.number().min(0, 'O valor não pode ser negativo.'),
  dueDate: z.string().min(1, 'Informe o vencimento.'),
  barcode: z.string().trim().max(100).optional().or(z.literal('')),
  paymentCode: z.string().trim().max(100).optional().or(z.literal('')),
  documentUrl: z.string().trim().max(500).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal(''))
})

export const updateObligationSchema = createObligationSchema.extend({
  id: z.string().guid('ID de obrigação inválido.')
})

export const obligationIdSchema = z.object({
  id: z.string().guid('ID de obrigação inválido.')
})

export const markObligationPaidSchema = z.object({
  id: z.string().guid('ID de obrigação inválido.'),
  journalEntryNumber: z.number().int().positive('Informe o número do lançamento contábil de pagamento.'),
  paidAt: z.string().min(1, 'Informe a data de pagamento.')
})

export const generateObligationFromAssessmentSchema = z.object({
  taxAssessmentId: z.string().guid('ID de apuração inválido.'),
  obligationType: z.string().min(1, 'Selecione o tipo de obrigação.'),
  dueDate: z.string().min(1, 'Informe o vencimento.')
})

export type CreateObligationInput = z.infer<typeof createObligationSchema>
export type UpdateObligationInput = z.infer<typeof updateObligationSchema>
export type MarkObligationPaidInput = z.infer<typeof markObligationPaidSchema>
export type GenerateObligationFromAssessmentInput = z.infer<typeof generateObligationFromAssessmentSchema>
