import { z } from 'zod'

export const createEstablishmentSchema = z.object({
  type: z.enum(['HEADQUARTERS', 'BRANCH']),
  code: z.string().trim().max(30).optional().or(z.literal('')),
  name: z.string().trim().max(150).optional().or(z.literal('')),
  cnpj: z.string().trim().min(11, 'Informe o CNPJ do estabelecimento.').max(20),
  stateRegistration: z.string().trim().max(30).optional().or(z.literal('')),
  municipalRegistration: z.string().trim().max(30).optional().or(z.literal('')),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  state: z.string().trim().length(2).optional().or(z.literal('')),
  municipalityCode: z.string().trim().max(10).optional().or(z.literal('')),
  addressLine: z.string().trim().max(250).optional().or(z.literal(''))
})

export const updateEstablishmentSchema = createEstablishmentSchema.extend({
  id: z.string().guid('ID de estabelecimento inválido.')
})

export const toggleEstablishmentActiveSchema = z.object({
  id: z.string().guid(),
  active: z.boolean()
})

export type CreateEstablishmentInput = z.infer<typeof createEstablishmentSchema>
export type UpdateEstablishmentInput = z.infer<typeof updateEstablishmentSchema>
