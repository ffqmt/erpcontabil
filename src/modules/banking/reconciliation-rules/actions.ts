'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageReconciliationRules, canReconcileBankStatements } from '@/lib/permissions/permissions'
import {
  createReconciliationRuleSchema,
  updateReconciliationRuleSchema,
  toggleReconciliationRuleActiveSchema,
  deleteReconciliationRuleSchema,
  applyReconciliationRuleSchema
} from './validations'
import { findMatchingReconciliationRule } from './queries'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function toRow(input: {
  name: string
  keyword: string
  direction: 'CREDIT' | 'DEBIT' | 'ANY'
  counterpartyAccountId: string
  partnerId?: string
  costCenterId?: string
  descriptionTemplate?: string
  priority: number
}) {
  return {
    name: input.name,
    keyword: input.keyword,
    direction: input.direction,
    counterparty_account_id: input.counterpartyAccountId,
    partner_id: input.partnerId || null,
    cost_center_id: input.costCenterId || null,
    description_template: input.descriptionTemplate || null,
    priority: input.priority
  }
}

// =====================================================================================
// CRUD de regras
// =====================================================================================

export async function createReconciliationRuleAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageReconciliationRules())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para administrar regras de conciliação.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createReconciliationRuleSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const { data: account, error: accountError } = await db
      .from('chart_accounts')
      .select('id, company_id, is_active, is_synthetic, accepts_entries')
      .eq('id', validation.data.counterpartyAccountId)
      .single()

    if (accountError || !account || account.company_id !== context.companyId) {
      return { ok: false, error: 'A conta de contrapartida informada não existe ou pertence a outra empresa.', code: 'INVALID_ACCOUNT' }
    }
    if (!account.is_active || account.is_synthetic || !account.accepts_entries) {
      return { ok: false, error: 'A conta de contrapartida deve ser analítica, ativa e aceitar lançamentos.', code: 'INVALID_ACCOUNT' }
    }

    const { data, error } = await db
      .from('bank_reconciliation_rules')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        active: true,
        ...toRow(validation.data)
      })
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '42501') {
        return { ok: false, error: 'Sua função não permite administrar regras de conciliação — apenas Contador/OWNER/ADMIN.', code: 'INSUFFICIENT_PERMISSIONS' }
      }
      throw error || new Error('Falha ao criar regra de conciliação.')
    }

    revalidatePath('/bancos/regras')
    return { ok: true, data: { id: data.id }, message: 'Regra de conciliação criada com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao criar regra de conciliação:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateReconciliationRuleAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageReconciliationRules())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para administrar regras de conciliação.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateReconciliationRuleSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...fields } = validation.data

  try {
    const { data, error } = await db
      .from('bank_reconciliation_rules')
      .update(toRow(fields))
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao atualizar regra de conciliação.')

    revalidatePath('/bancos/regras')
    return { ok: true, data: { id: data.id }, message: 'Regra de conciliação atualizada com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao atualizar regra de conciliação:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function toggleReconciliationRuleActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; active: boolean }>> {
  if (!(await canManageReconciliationRules())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para administrar regras de conciliação.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = toggleReconciliationRuleActiveSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, active } = validation.data

  try {
    const { data, error } = await db
      .from('bank_reconciliation_rules')
      .update({ active })
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id, active')
      .single()

    if (error || !data) throw error || new Error('Falha ao alterar status da regra.')

    revalidatePath('/bancos/regras')
    return { ok: true, data: { id: data.id, active: data.active }, message: data.active ? 'Regra reativada.' : 'Regra desativada.' }
  } catch (error: any) {
    console.error('Erro ao alterar status da regra de conciliação:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function deleteReconciliationRuleAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageReconciliationRules())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para administrar regras de conciliação.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = deleteReconciliationRuleSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const { error } = await db
      .from('bank_reconciliation_rules')
      .delete()
      .eq('id', validation.data.id)
      .eq('company_id', context.companyId)

    if (error) throw error

    revalidatePath('/bancos/regras')
    return { ok: true, data: { id: validation.data.id }, message: 'Regra excluída.' }
  } catch (error: any) {
    console.error('Erro ao excluir regra de conciliação:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// Aplicar regra a uma linha de extrato — gera um lançamento em RASCUNHO (DRAFT), NUNCA
// posta automaticamente ("Não autopostar sem confirmação" — restrição explícita da Etapa
// 30A). O usuário revisa e posta manualmente pelo módulo de Lançamentos (ou por um botão
// dedicado de revisão na tela de conciliação), exatamente como o motor de regras do
// protótipo legado sistema.html (extratoGerarLancamentosTX) — que também só gera RASCUNHO.
// =====================================================================================

export async function applyReconciliationRuleToLineAction(rawInput: unknown): Promise<ActionResult<{ journalEntryId: string; ruleName: string }>> {
  const canReconcile = await canReconcileBankStatements()
  if (!canReconcile) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para conciliar extratos.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = applyReconciliationRuleSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { lineId } = validation.data

  try {
    const { data: line, error: lineErr } = await db
      .from('bank_statement_lines')
      .select('*')
      .eq('id', lineId)
      .eq('company_id', context.companyId)
      .single()

    if (lineErr || !line) {
      return { ok: false, error: 'Linha de extrato não encontrada ou não pertence a esta empresa.', code: 'LINE_NOT_FOUND' }
    }
    if (line.status === 'RECONCILED' || line.status === 'IGNORED') {
      return { ok: false, error: 'Esta linha não pode receber uma regra automática no status atual.', code: 'INVALID_LINE_STATUS' }
    }

    const amount = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
    const rule = await findMatchingReconciliationRule(context.companyId, line.description, amount)
    if (!rule) {
      return { ok: false, error: 'Nenhuma regra ativa casa com a descrição/sentido desta linha.', code: 'NO_RULE_MATCH' }
    }

    const { data: bankAccount } = await db.from('bank_accounts').select('chart_account_id, active').eq('id', line.bank_account_id).single()
    if (!bankAccount?.chart_account_id || !bankAccount.active) {
      return { ok: false, error: 'A conta bancária desta linha não possui conta contábil vinculada/ativa.', code: 'BANK_ACCOUNT_WITHOUT_CHART_ACCOUNT' }
    }

    const { data: counterpartyAccount } = await db
      .from('chart_accounts')
      .select('id, is_active, is_synthetic, accepts_entries')
      .eq('id', rule.counterparty_account_id)
      .single()
    if (!counterpartyAccount || !counterpartyAccount.is_active || counterpartyAccount.is_synthetic || !counterpartyAccount.accepts_entries) {
      return { ok: false, error: `A conta de contrapartida da regra "${rule.name}" não está mais ativa/analítica. Ajuste a regra antes de aplicá-la novamente.`, code: 'INVALID_RULE_ACCOUNT' }
    }

    const entryDateParts = line.entry_date.split('-')
    const competenceStart = `${entryDateParts[0]}-${entryDateParts[1]}-01`

    const { data: period, error: periodError } = await db
      .from('accounting_periods')
      .select('status')
      .eq('company_id', context.companyId)
      .eq('competence', competenceStart)
      .single()

    if (periodError || !period) {
      return { ok: false, error: `Período contábil para a competência ${competenceStart} não encontrado.`, code: 'PERIOD_NOT_FOUND' }
    }
    if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
      return { ok: false, error: `O período contábil (${competenceStart}) está fechado (${period.status}). Operações bloqueadas.`, code: 'PERIOD_CLOSED' }
    }

    const isInflow = amount > 0
    const absAmount = Math.abs(amount)
    const historico = (rule.description_template || line.description || '').trim() || line.description

    const { data: newEntry, error: insertError } = await db
      .from('journal_entries')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        entry_date: line.entry_date,
        competence: competenceStart,
        description: historico,
        document: line.document_number || null,
        partner_id: rule.partner_id || null,
        origin: 'BANK_STATEMENT',
        origin_id: line.id,
        status: 'DRAFT'
      })
      .select('id')
      .single()

    if (insertError || !newEntry) {
      throw insertError || new Error('Falha ao criar o rascunho gerado pela regra.')
    }

    const { error: linesError } = await db.from('journal_entry_lines').insert([
      {
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        journal_entry_id: newEntry.id,
        account_id: bankAccount.chart_account_id,
        debit_credit: isInflow ? 'DEBIT' : 'CREDIT',
        amount: absAmount,
        memo: historico,
        bank_statement_line_id: line.id
      },
      {
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        journal_entry_id: newEntry.id,
        account_id: rule.counterparty_account_id,
        debit_credit: isInflow ? 'CREDIT' : 'DEBIT',
        amount: absAmount,
        memo: historico,
        cost_center_id: rule.cost_center_id || null
      }
    ])

    if (linesError) {
      await db.from('journal_entries').delete().eq('id', newEntry.id)
      throw linesError
    }

    // Marca a linha como CLASSIFIED (sugestão aplicada, rascunho gerado) — NÃO como
    // RECONCILED, que neste app sempre significa "vinculada a um lançamento POSTED" (ver
    // comentário em db/migrations/erp_schema_v1_3_*.sql). O usuário revisa e posta o
    // rascunho pelo módulo de Lançamentos; ao postar, pode voltar aqui e usar "Vincular a
    // Lançamento Existente" para concluir a conciliação, ou gerar via "Gerar Lançamento e
    // Conciliar" diretamente se preferir descartar o rascunho da regra.
    await db
      .from('bank_statement_lines')
      .update({
        counterparty_account_id: rule.counterparty_account_id,
        partner_id: rule.partner_id || null,
        cost_center_id: rule.cost_center_id || null,
        classification_memo: `Regra aplicada: ${rule.name}`,
        status: 'CLASSIFIED'
      })
      .eq('id', lineId)
      .eq('company_id', context.companyId)

    revalidatePath('/bancos')
    revalidatePath('/bancos/conciliacao')
    revalidatePath(`/bancos/conciliacao/${lineId}`)
    revalidatePath('/contabilidade/lancamentos')

    return {
      ok: true,
      data: { journalEntryId: newEntry.id, ruleName: rule.name },
      message: `Rascunho gerado pela regra "${rule.name}". Revise em Lançamentos e poste manualmente para concluir a conciliação.`
    }
  } catch (error: any) {
    console.error('Erro ao aplicar regra de conciliação:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
