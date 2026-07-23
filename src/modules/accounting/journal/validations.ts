import { z } from 'zod'

export const createManualJournalEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido. Use AAAA-MM-DD.'),
  description: z.string().min(3, 'O histórico geral deve ter pelo menos 3 caracteres.'),
  document: z.string().trim().max(60).optional().or(z.literal('')),
  partnerId: z.string().guid('ID de parceiro inválido.').optional().or(z.literal('')),
  lines: z.array(
    z.object({
      accountId: z.string().guid('ID de conta inválido.'),
      debitCredit: z.enum(['DEBIT', 'CREDIT']),
      amount: z.number().positive('O valor deve ser maior que zero.'),
      memo: z.string().optional().nullable(),
      costCenterId: z.string().guid('ID de centro de custo inválido.').optional().nullable()
    })
  ).min(2, 'O lançamento contábil deve conter pelo menos 2 linhas (partidas dobradas).')
})

export const postJournalEntrySchema = z.object({
  journalEntryId: z.string().guid('ID de lançamento inválido.')
})

export const reverseJournalEntrySchema = z.object({
  journalEntryId: z.string().guid('ID de lançamento inválido.'),
  reason: z.string().min(5, 'O motivo do estorno deve conter pelo menos 5 caracteres.').max(500, 'O motivo deve conter no máximo 500 caracteres.')
})

export type CreateManualJournalEntryInput = z.infer<typeof createManualJournalEntrySchema>
export type PostJournalEntryInput = z.infer<typeof postJournalEntrySchema>
export type ReverseJournalEntryInput = z.infer<typeof reverseJournalEntrySchema>
