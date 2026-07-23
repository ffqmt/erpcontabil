import { z } from 'zod'

export const createTaxAssessmentSchema = z.object({
  taxType: z.enum(['ISS', 'ICMS', 'IPI', 'PIS', 'COFINS', 'SIMPLES', 'INSS_RETIDO', 'IRRF', 'PCC', 'IRPJ', 'CSLL', 'OTHER']),
  competence: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Informe a competência no formato AAAA-MM.'),
  dueDate: z.string().optional().or(z.literal(''))
})

export const taxAssessmentIdSchema = z.object({
  id: z.string().guid('ID de apuração inválido.')
})

// A partir da Etapa 24, adjustmentAmount deixou de ser gravável diretamente aqui — passa a
// ser DERIVADO das linhas manuais ADJUSTMENT_POSITIVE/ADJUSTMENT_NEGATIVE (ver
// addTaxAssessmentManualLineAction). previousBalanceAmount também saiu daqui — tem action
// dedicada (updateTaxAssessmentPreviousBalanceAction). Este schema fica só com os 2 campos
// que continuam sendo valores diretos na fórmula: multa e juros.
export const adjustTaxAssessmentSchema = z.object({
  id: z.string().guid('ID de apuração inválido.'),
  fineAmount: z.number().min(0).optional(),
  interestAmount: z.number().min(0).optional()
})

export const accountTaxAssessmentSchema = z.object({
  id: z.string().guid('ID de apuração inválido.'),
  debitAccountId: z.string().guid('Selecione a conta de débito (despesa/dedução).'),
  creditAccountId: z.string().guid('Selecione a conta de crédito (imposto a recolher).')
})

const MANUAL_LINE_TYPES = ['DEBIT', 'CREDIT', 'RETENTION', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE'] as const

export const addTaxAssessmentManualLineSchema = z.object({
  taxAssessmentId: z.string().guid('ID de apuração inválido.'),
  lineType: z.enum(MANUAL_LINE_TYPES),
  description: z.string().trim().min(3, 'Descrição obrigatória (mínimo 3 caracteres).').max(300),
  amount: z.number().min(0.01, 'O valor deve ser maior que zero.'),
  baseAmount: z.number().min(0).optional(),
  taxRate: z.number().min(0).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal(''))
})

export const updateTaxAssessmentManualLineSchema = addTaxAssessmentManualLineSchema.extend({
  id: z.string().guid('ID de linha inválido.')
})

export const deleteTaxAssessmentManualLineSchema = z.object({
  id: z.string().guid('ID de linha inválido.'),
  taxAssessmentId: z.string().guid('ID de apuração inválido.')
})

export const updateTaxAssessmentPreviousBalanceSchema = z.object({
  id: z.string().guid('ID de apuração inválido.'),
  previousBalanceAmount: z.number().min(0, 'O saldo anterior não pode ser negativo.')
})

// Etapa 34A — IRPJ/CSLL
export const calculateIncomeTaxAssessmentSchema = z.object({
  id: z.string().guid('ID de apuração inválido.')
})

export const addTaxAssessmentAdjustmentSchema = z.object({
  assessmentId: z.string().guid('ID de apuração inválido.'),
  taxType: z.enum(['IRPJ', 'CSLL']),
  adjustmentType: z.enum(['ADDITION', 'EXCLUSION', 'COMPENSATION']),
  description: z.string().trim().min(3, 'Descrição obrigatória.').max(300),
  amount: z.number().min(0.01, 'O valor deve ser maior que zero.')
})

export const deleteTaxAssessmentAdjustmentSchema = z.object({
  id: z.string().guid('ID de ajuste inválido.'),
  assessmentId: z.string().guid('ID de apuração inválido.')
})

export const createBatchTaxAssessmentSchema = z.object({
  competence: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Informe a competência no formato AAAA-MM.'),
  dueDate: z.string().optional().or(z.literal(''))
})

export type CreateTaxAssessmentInput = z.infer<typeof createTaxAssessmentSchema>
export type CreateBatchTaxAssessmentInput = z.infer<typeof createBatchTaxAssessmentSchema>
export type AdjustTaxAssessmentInput = z.infer<typeof adjustTaxAssessmentSchema>
export type AccountTaxAssessmentInput = z.infer<typeof accountTaxAssessmentSchema>
export type AddTaxAssessmentManualLineInput = z.infer<typeof addTaxAssessmentManualLineSchema>
export type UpdateTaxAssessmentManualLineInput = z.infer<typeof updateTaxAssessmentManualLineSchema>
export type UpdateTaxAssessmentPreviousBalanceInput = z.infer<typeof updateTaxAssessmentPreviousBalanceSchema>

