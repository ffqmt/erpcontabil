'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageRegistrations } from '@/lib/permissions/permissions'
import { createPartnerSchema, updatePartnerSchema, togglePartnerActiveSchema } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function toRow(input: {
  name: string
  legalName?: string
  tradeName?: string
  document?: string
  documentType?: 'CPF' | 'CNPJ'
  email?: string
  phone?: string
  stateRegistration?: string
  municipalRegistration?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  notes?: string
  isCustomer: boolean
  isSupplier: boolean
  isCarrier: boolean
  isEmployee: boolean
}) {
  return {
    name: input.name,
    legal_name: input.legalName || null,
    trade_name: input.tradeName || null,
    document: input.document || null,
    document_type: input.documentType || null,
    email: input.email || null,
    phone: input.phone || null,
    state_registration: input.stateRegistration || null,
    municipal_registration: input.municipalRegistration || null,
    address: input.address || null,
    city: input.city || null,
    state: input.state ? input.state.toUpperCase() : null,
    zip_code: input.zipCode || null,
    notes: input.notes || null,
    is_customer: input.isCustomer,
    is_supplier: input.isSupplier,
    is_carrier: input.isCarrier,
    is_employee: input.isEmployee
  }
}

// =====================================================================================
// Etapa 30A — criação automática opcional de conta contábil analítica para o parceiro.
// Cliente -> filha de 1.1.2 CLIENTES; Fornecedor -> filha de 2.1.1 FORNECEDORES. Roda
// ANTES de gravar o parceiro (chart_accounts não tem policy de DELETE — ver
// src/modules/accounting/accounts/actions.ts — então não daria para "desfazer" uma conta
// criada se a gravação do parceiro falhasse depois; criar a conta primeiro e só then linkar
// evita esse cenário de inconsistência irreversível).
// =====================================================================================

const ROLE_ACCOUNT_CONFIG = {
  customer: { parentCode: '1.1.2', label: 'Cliente' },
  supplier: { parentCode: '2.1.1', label: 'Fornecedor' }
} as const

// Exportada (Etapa 32B) para reaproveitamento pelo módulo de importação de XML fiscal
// (src/modules/fiscal/xml-import/actions.ts) — mesma lógica de criação de conta contábil
// automática de Cliente/Fornecedor, sem duplicar implementação.
export async function createLinkedAccountForRole(
  db: any,
  companyId: string,
  workspaceId: string,
  role: 'customer' | 'supplier',
  partnerName: string
): Promise<{ id: string } | { error: string }> {
  const { parentCode, label } = ROLE_ACCOUNT_CONFIG[role]

  const { data: parent, error: parentError } = await db
    .from('chart_accounts')
    .select('id, code, account_type, normal_balance, is_synthetic, accepts_entries')
    .eq('company_id', companyId)
    .eq('code', parentCode)
    .maybeSingle()

  if (parentError || !parent) {
    return { error: `Conta sintética padrão "${parentCode}" (${label === 'Cliente' ? 'CLIENTES' : 'FORNECEDORES'}) não foi encontrada no plano de contas desta empresa. Crie-a antes de solicitar a criação automática de conta de ${label.toLowerCase()}.` }
  }
  if (!parent.is_synthetic || parent.accepts_entries) {
    return { error: `A conta "${parentCode}" existe mas não está marcada como sintética. Ajuste o plano de contas antes de solicitar a criação automática.` }
  }

  // Próximo número de sequência: maior sufixo numérico dentre as filhas diretas de
  // parentCode (formato "1.1.2.01"), +1, com 2 dígitos (mesmo padrão da seed).
  const { data: siblings } = await db
    .from('chart_accounts')
    .select('code')
    .eq('company_id', companyId)
    .like('code', `${parentCode}.%`)

  let maxSeq = 0
  for (const s of siblings || []) {
    const suffix = (s.code as string).slice(parentCode.length + 1)
    if (/^\d+$/.test(suffix)) {
      const n = parseInt(suffix, 10)
      if (n > maxSeq) maxSeq = n
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const nextSeq = maxSeq + 1 + attempt
    const code = `${parentCode}.${String(nextSeq).padStart(2, '0')}`

    const { data: inserted, error: insertError } = await db
      .from('chart_accounts')
      .insert({
        workspace_id: workspaceId,
        company_id: companyId,
        parent_id: parent.id,
        code,
        name: `${label} - ${partnerName}`.slice(0, 200),
        account_type: parent.account_type,
        normal_balance: parent.normal_balance,
        is_synthetic: false,
        accepts_entries: true,
        is_active: true
      })
      .select('id')
      .single()

    if (!insertError && inserted) {
      return { id: inserted.id }
    }
    if (insertError?.code !== '23505') {
      return { error: insertError?.message || `Falha ao criar automaticamente a conta contábil de ${label.toLowerCase()}.` }
    }
    // 23505 (código duplicado, corrida concorrente) -> tenta o próximo número.
  }

  return { error: `Não foi possível encontrar um código livre para a conta de ${label.toLowerCase()} após múltiplas tentativas. Tente novamente.` }
}

export async function createPartnerAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createPartnerSchema.safeParse(rawInput)
  if (!validation.success) {
    return {
      ok: false,
      error: 'Erros de validação nos campos do formulário.',
      code: 'VALIDATION_ERROR',
      fieldErrors: validation.error.flatten().fieldErrors
    }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { createCustomerAccount, createSupplierAccount, ...partnerFields } = validation.data

  try {
    let customerAccountId: string | null = null
    let supplierAccountId: string | null = null

    if (createCustomerAccount && partnerFields.isCustomer) {
      const result = await createLinkedAccountForRole(db, context.companyId, context.workspaceId, 'customer', partnerFields.name)
      if ('error' in result) {
        return { ok: false, error: result.error, code: 'ACCOUNT_CREATION_FAILED' }
      }
      customerAccountId = result.id
    }
    if (createSupplierAccount && partnerFields.isSupplier) {
      const result = await createLinkedAccountForRole(db, context.companyId, context.workspaceId, 'supplier', partnerFields.name)
      if ('error' in result) {
        return { ok: false, error: result.error, code: 'ACCOUNT_CREATION_FAILED' }
      }
      supplierAccountId = result.id
    }

    const { data, error } = await db
      .from('partners')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        active: true,
        customer_account_id: customerAccountId,
        supplier_account_id: supplierAccountId,
        ...toRow(partnerFields)
      })
      .select('id')
      .single()

    if (error || !data) {
      // Etapa 32B: unique index uq_partners_company_document_normalized — já existe um
      // parceiro com o mesmo CPF/CNPJ nesta empresa (com ou sem máscara).
      if (error?.code === '23505') {
        return { ok: false, error: 'Já existe um parceiro com este CPF/CNPJ cadastrado nesta empresa (mesmo com máscara diferente).', code: 'DUPLICATE_DOCUMENT' }
      }
      throw error || new Error('Falha ao criar parceiro.')
    }

    revalidatePath('/cadastros/parceiros')
    revalidatePath('/cadastros')
    revalidatePath('/contabilidade/plano-contas')

    return { ok: true, data: { id: data.id }, message: 'Parceiro criado com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao criar parceiro:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updatePartnerAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updatePartnerSchema.safeParse(rawInput)
  if (!validation.success) {
    return {
      ok: false,
      error: 'Erros de validação nos campos do formulário.',
      code: 'VALIDATION_ERROR',
      fieldErrors: validation.error.flatten().fieldErrors
    }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, createCustomerAccount, createSupplierAccount, ...fields } = validation.data

  try {
    const { data: existing, error: existingError } = await db
      .from('partners')
      .select('id, customer_account_id, supplier_account_id')
      .eq('id', id)
      .eq('company_id', context.companyId)
      .single()

    if (existingError || !existing) {
      return { ok: false, error: 'Parceiro não encontrado ou pertence a outra empresa.', code: 'PARTNER_NOT_FOUND' }
    }

    const updateRow: Record<string, unknown> = toRow(fields)

    // Só cria a conta automática se ainda não houver vínculo (evita duplicar ao salvar
    // a edição repetidas vezes) e se o papel correspondente estiver marcado neste envio.
    if (createCustomerAccount && fields.isCustomer && !existing.customer_account_id) {
      const result = await createLinkedAccountForRole(db, context.companyId, context.workspaceId, 'customer', fields.name)
      if ('error' in result) {
        return { ok: false, error: result.error, code: 'ACCOUNT_CREATION_FAILED' }
      }
      updateRow.customer_account_id = result.id
    }
    if (createSupplierAccount && fields.isSupplier && !existing.supplier_account_id) {
      const result = await createLinkedAccountForRole(db, context.companyId, context.workspaceId, 'supplier', fields.name)
      if ('error' in result) {
        return { ok: false, error: result.error, code: 'ACCOUNT_CREATION_FAILED' }
      }
      updateRow.supplier_account_id = result.id
    }

    const { data, error } = await db
      .from('partners')
      .update(updateRow)
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return { ok: false, error: 'Já existe outro parceiro com este CPF/CNPJ cadastrado nesta empresa (mesmo com máscara diferente).', code: 'DUPLICATE_DOCUMENT' }
      }
      throw error || new Error('Falha ao atualizar parceiro.')
    }

    revalidatePath('/cadastros/parceiros')
    revalidatePath('/cadastros')
    revalidatePath('/contabilidade/plano-contas')

    return { ok: true, data: { id: data.id }, message: 'Parceiro atualizado com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao atualizar parceiro:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function togglePartnerActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; active: boolean }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = togglePartnerActiveSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, active } = validation.data

  try {
    const { data, error } = await db
      .from('partners')
      .update({ active })
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id, active')
      .single()

    if (error || !data) {
      throw error || new Error('Falha ao alterar status do parceiro.')
    }

    revalidatePath('/cadastros/parceiros')
    revalidatePath('/cadastros')

    return {
      ok: true,
      data: { id: data.id, active: data.active },
      message: data.active ? 'Parceiro reativado.' : 'Parceiro inativado.'
    }
  } catch (error: any) {
    console.error('Erro ao alterar status do parceiro:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
