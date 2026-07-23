'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageCompanies } from '@/lib/permissions/permissions'
import { createEstablishmentSchema, updateEstablishmentSchema, toggleEstablishmentActiveSchema } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function revalidateEstablishments() {
  revalidatePath('/fiscal/cadastros/estabelecimentos')
  revalidatePath('/fiscal/cadastros')
}

function toRow(input: {
  type: 'HEADQUARTERS' | 'BRANCH'
  code?: string
  name?: string
  cnpj: string
  stateRegistration?: string
  municipalRegistration?: string
  city?: string
  state?: string
  municipalityCode?: string
  addressLine?: string
}) {
  return {
    type: input.type,
    code: input.code || null,
    name: input.name || null,
    cnpj: input.cnpj,
    state_registration: input.stateRegistration || null,
    municipal_registration: input.municipalRegistration || null,
    city: input.city || null,
    state: input.state ? input.state.toUpperCase() : null,
    municipality_code: input.municipalityCode || null,
    address_line: input.addressLine || null
  }
}

export async function createEstablishmentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageCompanies())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createEstablishmentSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const { data, error } = await db
      .from('establishments')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        active: true,
        ...toRow(validation.data)
      })
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return { ok: false, error: 'Já existe um estabelecimento com este CNPJ nesta empresa.', code: 'DUPLICATE_CNPJ' }
      }
      throw error || new Error('Falha ao criar estabelecimento.')
    }

    revalidateEstablishments()
    return { ok: true, data: { id: data.id }, message: 'Estabelecimento criado com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao criar estabelecimento:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateEstablishmentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageCompanies())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateEstablishmentSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...fields } = validation.data

  try {
    const { data, error } = await db
      .from('establishments')
      .update(toRow(fields))
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return { ok: false, error: 'Já existe um estabelecimento com este CNPJ nesta empresa.', code: 'DUPLICATE_CNPJ' }
      }
      throw error || new Error('Falha ao atualizar estabelecimento.')
    }

    revalidateEstablishments()
    return { ok: true, data: { id: data.id }, message: 'Estabelecimento atualizado com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao atualizar estabelecimento:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function toggleEstablishmentActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; active: boolean }>> {
  if (!(await canManageCompanies())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = toggleEstablishmentActiveSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, active } = validation.data

  try {
    const { data, error } = await db
      .from('establishments')
      .update({ active })
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id, active')
      .single()

    if (error || !data) throw error || new Error('Falha ao alterar status do estabelecimento.')

    revalidateEstablishments()
    return { ok: true, data: { id: data.id, active: data.active }, message: data.active ? 'Estabelecimento reativado.' : 'Estabelecimento inativado.' }
  } catch (error: any) {
    console.error('Erro ao alterar status do estabelecimento:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
