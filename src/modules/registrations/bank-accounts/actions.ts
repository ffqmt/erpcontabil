'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageRegistrations } from '@/lib/permissions/permissions'
import { createBankAccountSchema, updateBankAccountSchema, toggleBankAccountActiveSchema } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function toRow(input: {
  chartAccountId: string
  bankName?: string
  bankCode?: string
  agency?: string
  accountNumber?: string
  accountDigit?: string
  accountType: 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT'
  holderName?: string
  holderDocument?: string
  openingBalance?: number
}) {
  return {
    chart_account_id: input.chartAccountId,
    bank_name: input.bankName || null,
    bank_code: input.bankCode || null,
    agency: input.agency || null,
    account_number: input.accountNumber || null,
    account_digit: input.accountDigit || null,
    account_type: input.accountType,
    holder_name: input.holderName || null,
    holder_document: input.holderDocument || null,
    opening_balance: input.openingBalance ?? null
  }
}

export async function createBankAccountAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createBankAccountSchema.safeParse(rawInput)
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
    const { data: account, error: accError } = await db
      .from('chart_accounts')
      .select('id, company_id')
      .eq('id', validation.data.chartAccountId)
      .single()

    if (accError || !account || account.company_id !== context.companyId) {
      // AUDITORIA (Etapa 28A): antes sempre retornava a mesma mensagem genérica, mascarando
      // se a causa era "conta de outra empresa" (esperado) ou um erro real de RLS/conexão
      // (accError com um código Postgrest, ex: sessão sem company_users, chave errada). Em
      // dev, anexa o erro real do Supabase para não obrigar a "adivinhar" a causa.
      const devDetail = process.env.NODE_ENV === 'development' && accError
        ? ` [dev] Supabase: ${accError.message} (code ${accError.code ?? 's/código'})`
        : ''
      return { ok: false, error: `A conta contábil informada não existe ou pertence a outra empresa.${devDetail}`, code: 'INVALID_ACCOUNT' }
    }

    const { data, error } = await db
      .from('bank_accounts')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        active: true,
        ...toRow(validation.data)
      })
      .select('id')
      .single()

    if (error || !data) {
      throw error || new Error('Falha ao criar conta bancária.')
    }

    revalidatePath('/cadastros/contas-bancarias')
    revalidatePath('/cadastros')

    return { ok: true, data: { id: data.id }, message: 'Conta bancária criada com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao criar conta bancária:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateBankAccountAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateBankAccountSchema.safeParse(rawInput)
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
    const { data: account, error: accError } = await db
      .from('chart_accounts')
      .select('id, company_id')
      .eq('id', fields.chartAccountId)
      .single()

    if (accError || !account || account.company_id !== context.companyId) {
      const devDetail = process.env.NODE_ENV === 'development' && accError
        ? ` [dev] Supabase: ${accError.message} (code ${accError.code ?? 's/código'})`
        : ''
      return { ok: false, error: `A conta contábil informada não existe ou pertence a outra empresa.${devDetail}`, code: 'INVALID_ACCOUNT' }
    }

    const { data, error } = await db
      .from('bank_accounts')
      .update(toRow(fields))
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id')
      .single()

    if (error || !data) {
      throw error || new Error('Falha ao atualizar conta bancária.')
    }

    revalidatePath('/cadastros/contas-bancarias')
    revalidatePath('/cadastros')

    return { ok: true, data: { id: data.id }, message: 'Conta bancária atualizada com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao atualizar conta bancária:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function toggleBankAccountActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; active: boolean }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = toggleBankAccountActiveSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, active } = validation.data

  try {
    const { data, error } = await db
      .from('bank_accounts')
      .update({ active })
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id, active')
      .single()

    if (error || !data) {
      throw error || new Error('Falha ao alterar status da conta bancária.')
    }

    revalidatePath('/cadastros/contas-bancarias')
    revalidatePath('/cadastros')

    return {
      ok: true,
      data: { id: data.id, active: data.active },
      message: data.active ? 'Conta bancária reativada.' : 'Conta bancária inativada.'
    }
  } catch (error: any) {
    console.error('Erro ao alterar status da conta bancária:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
