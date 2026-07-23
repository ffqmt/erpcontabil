import { z } from 'zod'

const companyFields = z.object({
  legalName: z.string().trim().min(2, 'Razão Social deve ter pelo menos 2 caracteres.').max(200),
  tradeName: z.string().trim().max(200).optional().or(z.literal('')),
  cnpj: z.string().trim().min(11, 'CNPJ/CPF inválido.').max(20),
  stateRegistration: z.string().trim().max(30).optional().or(z.literal('')),
  municipalRegistration: z.string().trim().max(30).optional().or(z.literal('')),
  nire: z.string().trim().max(30).optional().or(z.literal('')),
  incorporationDate: z.string().trim().optional().or(z.literal('')),
  taxRegime: z.enum(['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL']),
  companyProfile: z.enum(['TRANSPORTATION', 'TRADE', 'SERVICES', 'INDUSTRY', 'OTHER']),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  state: z.string().trim().length(2, 'UF deve ter 2 letras.').optional().or(z.literal('')),
  responsibleName: z.string().trim().max(200).optional().or(z.literal('')),
  responsibleCpf: z.string().trim().max(20).optional().or(z.literal('')),
  responsibleRole: z.string().trim().max(100).optional().or(z.literal('')),
  responsibleCrc: z.string().trim().max(30).optional().or(z.literal('')),
  mainCnae: z.string().trim().max(20).optional().or(z.literal('')),
  secondaryCnaes: z.array(z.string().trim().max(20)).max(30).optional().default([])
})

export const createCompanySchema = companyFields.extend({
  createDefaultChartAccounts: z.boolean().optional().default(true),
  createInitialPeriod: z.boolean().optional().default(true),
  initialPeriodCompetence: z.string().trim().optional().or(z.literal(''))
})

export const updateCompanySchema = companyFields.extend({
  id: z.string().guid('ID de empresa inválido.')
})

export const toggleCompanyActiveSchema = z.object({
  id: z.string().guid('ID de empresa inválido.'),
  active: z.boolean()
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
export type ToggleCompanyActiveInput = z.infer<typeof toggleCompanyActiveSchema>
