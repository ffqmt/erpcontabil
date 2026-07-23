'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageChartAccounts } from '@/lib/permissions/permissions'
import { createChartAccountSchema, updateChartAccountSchema, toggleChartAccountActiveSchema } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

function revalidateAccounts() {
  revalidatePath('/contabilidade/plano-contas')
}

// Regra pedida na Etapa 28A: is_synthetic=true <-> accepts_entries=false sempre juntos —
// nunca editável independentemente pela UI (a própria constraint chk_chart_accounts_synthetic_no_entries
// já bloqueia no banco qualquer combinação inconsistente; aqui só espelhamos a regra para
// nunca nem tentar enviar uma combinação inválida).
function accountRow(input: { code: string; name: string; accountType: string; normalBalance: string; parentId?: string; isSynthetic: boolean }) {
  return {
    code: input.code,
    name: input.name,
    account_type: input.accountType,
    normal_balance: input.normalBalance,
    parent_id: input.parentId || null,
    is_synthetic: input.isSynthetic,
    accepts_entries: !input.isSynthetic
  }
}

export async function createChartAccountAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageChartAccounts())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar o plano de contas.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createChartAccountSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getClient()
  const input = validation.data

  try {
    if (input.parentId) {
      const { data: parent, error: parentError } = await db.from('chart_accounts').select('id, company_id, is_synthetic, accepts_entries').eq('id', input.parentId).single()
      if (parentError || !parent || parent.company_id !== context.companyId) {
        return { ok: false, error: 'A conta pai informada não existe ou pertence a outra empresa.', code: 'INVALID_PARENT' }
      }
      // Regra pedida: "conta com filhos não deve aceitar lançamentos" — se a conta pai
      // ainda está marcada como analítica (aceita lançamento), bloqueia em vez de virar
      // sintética silenciosamente (o usuário decide isso explicitamente, editando o pai).
      if (parent.accepts_entries) {
        return { ok: false, error: 'A conta pai selecionada ainda aceita lançamentos diretos (é analítica). Marque-a como sintética antes de criar uma subconta.', code: 'PARENT_NOT_SYNTHETIC' }
      }
    }

    const { data, error } = await db
      .from('chart_accounts')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        is_active: true,
        ...accountRow(input)
      })
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '23505') return { ok: false, error: `Já existe uma conta com o código ${input.code} nesta empresa.`, code: 'DUPLICATE_CODE' }
      throw error || new Error('Falha ao criar conta contábil.')
    }

    revalidateAccounts()
    return { ok: true, data: { id: data.id }, message: 'Conta contábil criada.' }
  } catch (error: any) {
    console.error('Erro ao criar conta contábil:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateChartAccountAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageChartAccounts())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar o plano de contas.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateChartAccountSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getClient()
  const { id, ...fields } = validation.data

  try {
    if (fields.parentId === id) {
      return { ok: false, error: 'Uma conta não pode ser pai de si mesma.', code: 'INVALID_PARENT' }
    }

    if (fields.parentId) {
      const { data: parent, error: parentError } = await db.from('chart_accounts').select('id, company_id, accepts_entries').eq('id', fields.parentId).single()
      if (parentError || !parent || parent.company_id !== context.companyId) {
        return { ok: false, error: 'A conta pai informada não existe ou pertence a outra empresa.', code: 'INVALID_PARENT' }
      }
      if (parent.accepts_entries) {
        return { ok: false, error: 'A conta pai selecionada ainda aceita lançamentos diretos (é analítica). Marque-a como sintética antes de vincular uma subconta.', code: 'PARENT_NOT_SYNTHETIC' }
      }
    }

    const { error } = await db.from('chart_accounts').update(accountRow(fields)).eq('id', id).eq('company_id', context.companyId)

    if (error) {
      if (error.code === '23505') return { ok: false, error: `Já existe uma conta com o código ${fields.code} nesta empresa.`, code: 'DUPLICATE_CODE' }
      // A trigger fn_protect_chart_account_entry_flags bloqueia converter em sintética/não-
      // lançável uma conta que já tem lançamentos — repassa a mensagem real do banco (não
      // mascarar erro, conforme pedido) em vez de um genérico.
      throw error
    }

    revalidateAccounts()
    return { ok: true, data: { id }, message: 'Conta contábil atualizada.' }
  } catch (error: any) {
    console.error('Erro ao atualizar conta contábil:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function toggleChartAccountActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; active: boolean }>> {
  if (!(await canManageChartAccounts())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar o plano de contas.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = toggleChartAccountActiveSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getClient()
  const { id, active } = validation.data

  try {
    // Inativar é sempre soft (is_active=false) — nunca há exclusão física (RLS de
    // chart_accounts não tem policy de DELETE, então nem seria possível). Contas inativas
    // continuam existindo para relatórios históricos; só somem dos selects de lançamento
    // novo (queries.ts / account-select.tsx já filtram is_active=true).
    const { data, error } = await db.from('chart_accounts').update({ is_active: active }).eq('id', id).eq('company_id', context.companyId).select('id, active:is_active').single()
    if (error || !data) throw error || new Error('Falha ao alterar status da conta contábil.')

    revalidateAccounts()
    return { ok: true, data: { id: data.id, active: data.active }, message: data.active ? 'Conta reativada.' : 'Conta inativada.' }
  } catch (error: any) {
    console.error('Erro ao alterar status da conta contábil:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
