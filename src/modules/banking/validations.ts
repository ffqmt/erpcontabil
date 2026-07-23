import { z } from 'zod'

export const importBankStatementCsvSchema = z.object({
  bankAccountId: z.string().guid('Selecione uma conta bancária.'),
  fileName: z.string().trim().max(200).optional().or(z.literal('')),
  csvText: z.string().trim().min(1, 'Cole ou envie o conteúdo do extrato em CSV.')
})

const classificationFields = z.object({
  lineId: z.string().guid('ID de linha de extrato inválido.'),
  counterpartyAccountId: z.string().guid('Selecione a conta contábil de contrapartida.'),
  partnerId: z.string().guid().optional().or(z.literal('')),
  costCenterId: z.string().guid().optional().or(z.literal('')),
  memo: z.string().trim().max(500).optional().or(z.literal(''))
})

export const classifyBankStatementLineSchema = classificationFields

export const generateJournalEntryFromBankLineSchema = classificationFields

export const ignoreBankStatementLineSchema = z.object({
  lineId: z.string().guid('ID de linha de extrato inválido.'),
  reason: z.string().trim().min(3, 'Informe uma justificativa para ignorar a linha.').max(500)
})

export const unreconcileBankStatementLineSchema = z.object({
  lineId: z.string().guid('ID de linha de extrato inválido.')
})

export const linkExistingJournalEntryLineSchema = z.object({
  lineId: z.string().guid('ID de linha de extrato inválido.'),
  journalEntryLineId: z.string().guid('ID de linha de lançamento inválido.')
})

export type ImportBankStatementCsvInput = z.infer<typeof importBankStatementCsvSchema>
export type ClassifyBankStatementLineInput = z.infer<typeof classifyBankStatementLineSchema>
export type GenerateJournalEntryFromBankLineInput = z.infer<typeof generateJournalEntryFromBankLineSchema>
export type IgnoreBankStatementLineInput = z.infer<typeof ignoreBankStatementLineSchema>
export type UnreconcileBankStatementLineInput = z.infer<typeof unreconcileBankStatementLineSchema>
export type LinkExistingJournalEntryLineInput = z.infer<typeof linkExistingJournalEntryLineSchema>
