import { z } from 'zod'

const partnerFields = z.object({
  name: z.string().trim().min(2, 'Nome/Razão Social deve ter pelo menos 2 caracteres.').max(200),
  legalName: z.string().trim().max(200).optional().or(z.literal('')),
  tradeName: z.string().trim().max(200).optional().or(z.literal('')),
  document: z.string().trim().max(20).optional().or(z.literal('')),
  documentType: z.enum(['CPF', 'CNPJ']).optional(),
  email: z.string().trim().email('E-mail inválido.').max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  stateRegistration: z.string().trim().max(30).optional().or(z.literal('')),
  municipalRegistration: z.string().trim().max(30).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  state: z.string().trim().length(2, 'UF deve ter 2 letras.').optional().or(z.literal('')),
  zipCode: z.string().trim().max(10).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  isCustomer: z.boolean().default(false),
  isSupplier: z.boolean().default(false),
  isCarrier: z.boolean().default(false),
  isEmployee: z.boolean().default(false),
  // Etapa 30A — criação automática opcional de conta contábil analítica vinculada ao
  // parceiro (filha de 1.1.2 CLIENTES / 2.1.1 FORNECEDORES). Só tem efeito se o papel
  // correspondente (isCustomer/isSupplier) também estiver marcado — validado na action.
  createCustomerAccount: z.boolean().default(false),
  createSupplierAccount: z.boolean().default(false)
})

function atLeastOneRole(data: { isCustomer: boolean; isSupplier: boolean; isCarrier: boolean; isEmployee: boolean }) {
  return data.isCustomer || data.isSupplier || data.isCarrier || data.isEmployee
}

const roleErrorConfig = {
  message: 'Selecione ao menos um papel: Cliente, Fornecedor, Transportadora ou Colaborador.',
  path: ['isCustomer']
}

export const createPartnerSchema = partnerFields.refine(atLeastOneRole, roleErrorConfig)

export const updatePartnerSchema = partnerFields
  .extend({ id: z.string().guid('ID de parceiro inválido.') })
  .refine(atLeastOneRole, roleErrorConfig)

export const togglePartnerActiveSchema = z.object({
  id: z.string().guid('ID de parceiro inválido.'),
  active: z.boolean()
})

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>
export type TogglePartnerActiveInput = z.infer<typeof togglePartnerActiveSchema>
