import { z } from 'zod'

export const importEsocialXmlSchema = z.object({
  fileName: z.string().trim().max(255).optional().or(z.literal('')),
  xmlText: z.string().trim().min(20, 'Informe o conteúdo do XML do eSocial.').max(10_000_000, 'XML muito grande para importação direta.')
})

export const accountPayrollEventSchema = z.object({
  id: z.string().uuid('ID de evento eSocial inválido.'),
  salaryExpenseAccountId: z.string().uuid().optional().or(z.literal('')),
  salariesPayableAccountId: z.string().uuid('Selecione a conta de salários a pagar.'),
  inssPayableAccountId: z.string().uuid().optional().or(z.literal('')),
  irrfPayableAccountId: z.string().uuid().optional().or(z.literal('')),
  otherDeductionsAccountId: z.string().uuid().optional().or(z.literal('')),
  fgtsExpenseAccountId: z.string().uuid().optional().or(z.literal('')),
  fgtsPayableAccountId: z.string().uuid().optional().or(z.literal('')),
  employerInssExpenseAccountId: z.string().uuid().optional().or(z.literal('')),
  employerInssPayableAccountId: z.string().uuid().optional().or(z.literal('')),
  paymentAccountId: z.string().uuid().optional().or(z.literal(''))
})

export type ImportEsocialXmlInput = z.infer<typeof importEsocialXmlSchema>
export type AccountPayrollEventInput = z.infer<typeof accountPayrollEventSchema>
