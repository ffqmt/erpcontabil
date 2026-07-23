'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageRegistrations } from '@/lib/permissions/permissions'
import { createItemSchema, updateItemSchema, toggleItemActiveSchema } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function toRow(input: {
  code: string
  name: string
  description?: string
  itemType: 'PRODUCT' | 'SERVICE' | 'BOTH'
  unit?: string
  ncm?: string
  serviceCode?: string
  cest?: string
  gtin?: string
  defaultFiscalOperationNatureId?: string
  fiscalItemUsage?: string
}) {
  return {
    code: input.code,
    name: input.name,
    description: input.description || null,
    item_type: input.itemType,
    unit: input.unit || null,
    ncm: input.ncm || null,
    service_code: input.serviceCode || null,
    cest: input.cest || null,
    gtin: input.gtin || null,
    default_fiscal_operation_nature_id: input.defaultFiscalOperationNatureId || null,
    fiscal_item_usage: input.fiscalItemUsage || null
  }
}

export async function createItemAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createItemSchema.safeParse(rawInput)
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

  try {
    if (validation.data.defaultFiscalOperationNatureId) {
      const { data: nature } = await db.from('fiscal_operation_natures').select('id, company_id').eq('id', validation.data.defaultFiscalOperationNatureId).single()
      if (!nature || nature.company_id !== context.companyId) {
        return { ok: false, error: 'A natureza fiscal padrão informada não existe ou pertence a outra empresa.', code: 'INVALID_FISCAL_NATURE' }
      }
    }

    const { data, error } = await db
      .from('items')
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
        return { ok: false, error: 'Já existe um item com este código nesta empresa.', code: 'DUPLICATE_CODE' }
      }
      throw error || new Error('Falha ao criar item.')
    }

    revalidatePath('/cadastros/itens')
    revalidatePath('/cadastros')

    return { ok: true, data: { id: data.id }, message: 'Item criado com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao criar item:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateItemAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateItemSchema.safeParse(rawInput)
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
  const { id, ...fields } = validation.data

  try {
    if (fields.defaultFiscalOperationNatureId) {
      const { data: nature } = await db.from('fiscal_operation_natures').select('id, company_id').eq('id', fields.defaultFiscalOperationNatureId).single()
      if (!nature || nature.company_id !== context.companyId) {
        return { ok: false, error: 'A natureza fiscal padrão informada não existe ou pertence a outra empresa.', code: 'INVALID_FISCAL_NATURE' }
      }
    }

    const { data, error } = await db
      .from('items')
      .update(toRow(fields))
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return { ok: false, error: 'Já existe um item com este código nesta empresa.', code: 'DUPLICATE_CODE' }
      }
      throw error || new Error('Falha ao atualizar item.')
    }

    revalidatePath('/cadastros/itens')
    revalidatePath('/cadastros')

    return { ok: true, data: { id: data.id }, message: 'Item atualizado com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao atualizar item:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function toggleItemActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; active: boolean }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = toggleItemActiveSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, active } = validation.data

  try {
    const { data, error } = await db
      .from('items')
      .update({ active })
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id, active')
      .single()

    if (error || !data) {
      throw error || new Error('Falha ao alterar status do item.')
    }

    revalidatePath('/cadastros/itens')
    revalidatePath('/cadastros')

    return {
      ok: true,
      data: { id: data.id, active: data.active },
      message: data.active ? 'Item reativado.' : 'Item inativado.'
    }
  } catch (error: any) {
    console.error('Erro ao alterar status do item:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
