import { z } from 'zod'

const bankAccountFields = z.object({
  chartAccountId: z.string().guid('Selecione a conta contábil correspondente.'),
  bankName: z.string().trim().max(100).optional().or(z.literal('')),
  bankCode: z.string().trim().max(10).optional().or(z.literal('')),
  agency: z.string().trim().max(20).optional().or(z.literal('')),
  accountNumber: z.string().trim().max(30).optional().or(z.literal('')),
  accountDigit: z.string().trim().max(5).optional().or(z.literal('')),
  accountType: z.enum(['CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT']),
  holderName: z.string().trim().max(200).optional().or(z.literal('')),
  holderDocument: z.string().trim().max(20).optional().or(z.literal('')),
  openingBalance: z.number().optional()
})

export const createBankAccountSchema = bankAccountFields

export const updateBankAccountSchema = bankAccountFields.extend({
  id: z.string().guid('ID de conta bancária inválido.')
})

export const toggleBankAccountActiveSchema = z.object({
  id: z.string().guid('ID de conta bancária inválido.'),
  active: z.boolean()
})

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>
export type ToggleBankAccountActiveInput = z.infer<typeof toggleBankAccountActiveSchema>
