'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canPostFiscalToAccounting } from '@/lib/permissions/permissions'
import {
  createFiscalAccountingRuleSchema,
  updateFiscalAccountingRuleSchema,
  toggleFiscalAccountingRuleActiveSchema,
  deleteFiscalAccountingRuleSchema,
  duplicateFiscalAccountingRuleSchema
} from './validations'
import { legacyLinesFromRule } from './utils'
import type { AccountSource, DebitCredit, FiscalAccountingRule, FiscalAccountingRuleLine, ValueBase } from './types'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

type DbClient = Awaited<ReturnType<typeof getClient>>

type RuleLineInput = {
  debitCredit: DebitCredit
  accountSource: AccountSource
  accountId?: string
  valueBase: ValueBase
  amountMultiplier: number
  memoTemplate?: string
}

type RuleInput = {
  name: string
  description?: string
  priority: number
  documentType?: string
  documentTypes?: string[]
  direction?: 'IN' | 'OUT' | ''
  directions?: Array<'IN' | 'OUT'>
  cfop?: string
  cfops?: string[]
  cfopPattern?: string
  cfopPatterns?: string[]
  fiscalOperationNatureId?: string
  fiscalOperationNatureIds?: string[]
  itemType?: string
  itemTypes?: string[]
  partnerId?: string
  partnerIds?: string[]
  taxRegime?: string
  taxRegimes?: string[]
  minAmount?: number
  maxAmount?: number
  descriptionTemplate?: string
  lines: RuleLineInput[]
}

const legacyRuleValueBases = new Set<ValueBase>(['DOCUMENT_AMOUNT', 'MERCHANDISE_AMOUNT', 'SERVICES_AMOUNT', 'TOTAL_AMOUNT'])

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
}

function uniqueUpperValues(values: Array<string | null | undefined>): string[] {
  return uniqueValues(values).map((value) => value.toUpperCase())
}

function firstOrNull(values: string[]) {
  return values[0] || null
}

function copyRuleName(name: string) {
  const suffix = ' (cópia)'
  if (name.length + suffix.length <= 150) return `${name}${suffix}`
  return `${name.slice(0, 150 - suffix.length)}${suffix}`
}

function arrayWithFallback<T extends string>(values: T[] | null | undefined, fallback: T | null | undefined): T[] {
  if (values?.length) return values
  return fallback ? [fallback] : []
}

function linesInputFromStoredLines(lines: FiscalAccountingRuleLine[]): RuleLineInput[] {
  return lines.map((line) => ({
    debitCredit: line.debit_credit,
    accountSource: line.account_source,
    accountId: line.account_id || undefined,
    valueBase: line.value_base,
    amountMultiplier: Number(line.amount_multiplier ?? 1),
    memoTemplate: line.memo_template || undefined
  }))
}

function legacyColumnsFromLines(lines: RuleLineInput[]) {
  const debit = lines.find((line) => line.debitCredit === 'DEBIT')
  const credit = lines.find((line) => line.debitCredit === 'CREDIT')
  if (!debit || !credit) throw new Error('A regra precisa ter pelo menos uma partida de débito e uma de crédito.')

  return {
    debit_account_source: debit.accountSource,
    debit_account_id: debit.accountSource === 'FIXED' ? debit.accountId || null : null,
    credit_account_source: credit.accountSource,
    credit_account_id: credit.accountSource === 'FIXED' ? credit.accountId || null : null,
    value_base: legacyRuleValueBases.has(debit.valueBase) ? debit.valueBase : 'DOCUMENT_AMOUNT'
  }
}

function toRow(input: RuleInput) {
  const legacy = legacyColumnsFromLines(input.lines)
  const documentTypes = uniqueUpperValues([input.documentType, ...(input.documentTypes || [])])
  const directions = uniqueUpperValues([input.direction, ...(input.directions || [])]).filter((direction) => direction === 'IN' || direction === 'OUT')
  const cfops = uniqueUpperValues([input.cfop, ...(input.cfops || [])])
  const cfopPatterns = uniqueUpperValues([input.cfopPattern, ...(input.cfopPatterns || [])])
  const fiscalOperationNatureIds = uniqueValues([input.fiscalOperationNatureId, ...(input.fiscalOperationNatureIds || [])])
  const itemTypes = uniqueUpperValues([input.itemType, ...(input.itemTypes || [])])
  const partnerIds = uniqueValues([input.partnerId, ...(input.partnerIds || [])])
  const taxRegimes = uniqueUpperValues([input.taxRegime, ...(input.taxRegimes || [])])

  return {
    name: input.name,
    description: input.description || null,
    priority: input.priority,
    document_type: firstOrNull(documentTypes),
    document_types: documentTypes,
    direction: (directions[0] as 'IN' | 'OUT' | undefined) || null,
    directions,
    cfop: firstOrNull(cfops),
    cfops,
    cfop_pattern: firstOrNull(cfopPatterns),
    cfop_patterns: cfopPatterns,
    fiscal_operation_nature_id: firstOrNull(fiscalOperationNatureIds),
    fiscal_operation_nature_ids: fiscalOperationNatureIds,
    item_type: firstOrNull(itemTypes),
    item_types: itemTypes,
    partner_id: firstOrNull(partnerIds),
    partner_ids: partnerIds,
    tax_regime: firstOrNull(taxRegimes),
    tax_regimes: taxRegimes,
    min_amount: input.minAmount ?? null,
    max_amount: input.maxAmount ?? null,
    description_template: input.descriptionTemplate || null,
    ...legacy
  }
}

function toLineRow(context: { workspaceId: string; companyId: string }, ruleId: string, line: RuleLineInput, index: number) {
  return {
    workspace_id: context.workspaceId,
    company_id: context.companyId,
    rule_id: ruleId,
    line_order: index + 1,
    debit_credit: line.debitCredit,
    account_source: line.accountSource,
    account_id: line.accountSource === 'FIXED' ? line.accountId || null : null,
    value_base: line.valueBase,
    amount_multiplier: line.amountMultiplier,
    memo_template: line.memoTemplate || null
  }
}

async function assertFixedAccountValid(db: DbClient, companyId: string, accountId: string | null) {
  if (!accountId) return null
  const { data: acc } = await db.from('chart_accounts').select('id, company_id, is_active, is_synthetic, accepts_entries').eq('id', accountId).single()
  if (!acc || acc.company_id !== companyId) return 'Uma das contas fixas selecionadas não existe ou pertence a outra empresa.'
  if (!acc.is_active || acc.is_synthetic || !acc.accepts_entries) return 'Contas fixas de regra devem ser analíticas, ativas e aceitar lançamentos.'
  return null
}

async function assertRuleLinesFixedAccountsValid(db: DbClient, companyId: string, lines: RuleLineInput[]) {
  const fixedAccountIds = Array.from(new Set(lines.filter((line) => line.accountSource === 'FIXED').map((line) => line.accountId).filter(Boolean))) as string[]
  for (const accountId of fixedAccountIds) {
    const err = await assertFixedAccountValid(db, companyId, accountId)
    if (err) return err
  }
  return null
}

async function assertCompanyScopedIdsValid(db: DbClient, companyId: string, table: 'fiscal_operation_natures' | 'partners', ids: string[], errorMessage: string) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) return null

  const { data, error } = await db
    .from(table)
    .select('id, company_id')
    .in('id', uniqueIds)

  if (error) throw error
  const validIds = new Set((data || []).filter((row) => row.company_id === companyId).map((row) => row.id))
  if (uniqueIds.some((id) => !validIds.has(id))) return errorMessage
  return null
}

async function assertRuleConditionReferencesValid(db: DbClient, companyId: string, input: RuleInput) {
  const fiscalNatureIds = uniqueValues([input.fiscalOperationNatureId, ...(input.fiscalOperationNatureIds || [])])
  const partnerIds = uniqueValues([input.partnerId, ...(input.partnerIds || [])])

  const natureErr = await assertCompanyScopedIdsValid(db, companyId, 'fiscal_operation_natures', fiscalNatureIds, 'Uma das naturezas fiscais selecionadas não existe ou pertence a outra empresa.')
  if (natureErr) return natureErr

  const partnerErr = await assertCompanyScopedIdsValid(db, companyId, 'partners', partnerIds, 'Um dos parceiros selecionados não existe ou pertence a outra empresa.')
  if (partnerErr) return partnerErr

  return null
}

async function replaceRuleLines(db: DbClient, context: { workspaceId: string; companyId: string }, ruleId: string, lines: RuleLineInput[]) {
  const { error: deleteError } = await db
    .from('fiscal_accounting_rule_lines')
    .delete()
    .eq('rule_id', ruleId)
    .eq('company_id', context.companyId)

  if (deleteError) throw deleteError

  const { error: insertError } = await db
    .from('fiscal_accounting_rule_lines')
    .insert(lines.map((line, index) => toLineRow(context, ruleId, line, index)))

  if (insertError) throw insertError
}

export async function createFiscalAccountingRuleAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canPostFiscalToAccounting())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para administrar regras contábeis fiscais.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createFiscalAccountingRuleSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const data = validation.data

  try {
    const accountErr = await assertRuleLinesFixedAccountsValid(db, context.companyId, data.lines)
    if (accountErr) return { ok: false, error: accountErr, code: 'INVALID_ACCOUNT' }
    const conditionErr = await assertRuleConditionReferencesValid(db, context.companyId, data)
    if (conditionErr) return { ok: false, error: conditionErr, code: 'INVALID_CONDITION' }

    const { data: rule, error } = await db
      .from('fiscal_accounting_rules')
      .insert({ workspace_id: context.workspaceId, company_id: context.companyId, active: true, ...toRow(data) })
      .select('id')
      .single()

    if (error || !rule) {
      if (error?.code === '42501') {
        return { ok: false, error: 'Sua função não permite administrar regras contábeis fiscais — apenas Contador/OWNER/ADMIN.', code: 'INSUFFICIENT_PERMISSIONS' }
      }
      throw error || new Error('Falha ao criar regra contábil fiscal.')
    }

    try {
      await replaceRuleLines(db, context, rule.id, data.lines)
    } catch (lineError) {
      await db.from('fiscal_accounting_rules').delete().eq('id', rule.id).eq('company_id', context.companyId)
      throw lineError
    }

    revalidatePath('/fiscal/regras-contabeis')
    return { ok: true, data: { id: rule.id }, message: 'Regra contábil fiscal criada com sucesso!' }
  } catch (error: unknown) {
    console.error('Erro ao criar regra contábil fiscal:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateFiscalAccountingRuleAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canPostFiscalToAccounting())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para administrar regras contábeis fiscais.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateFiscalAccountingRuleSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...fields } = validation.data

  try {
    const accountErr = await assertRuleLinesFixedAccountsValid(db, context.companyId, fields.lines)
    if (accountErr) return { ok: false, error: accountErr, code: 'INVALID_ACCOUNT' }
    const conditionErr = await assertRuleConditionReferencesValid(db, context.companyId, fields)
    if (conditionErr) return { ok: false, error: conditionErr, code: 'INVALID_CONDITION' }

    const { data, error } = await db
      .from('fiscal_accounting_rules')
      .update(toRow(fields))
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao atualizar regra contábil fiscal.')

    await replaceRuleLines(db, context, id, fields.lines)

    revalidatePath('/fiscal/regras-contabeis')
    return { ok: true, data: { id: data.id }, message: 'Regra contábil fiscal atualizada com sucesso!' }
  } catch (error: unknown) {
    console.error('Erro ao atualizar regra contábil fiscal:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function duplicateFiscalAccountingRuleAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canPostFiscalToAccounting())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para administrar regras contábeis fiscais.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = duplicateFiscalAccountingRuleSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const { data: source, error: sourceError } = await db
      .from('fiscal_accounting_rules')
      .select('*')
      .eq('id', validation.data.id)
      .eq('company_id', context.companyId)
      .single()

    if (sourceError || !source) {
      return { ok: false, error: 'Regra contábil fiscal de origem não encontrada.', code: 'NOT_FOUND' }
    }

    const sourceRule = source as FiscalAccountingRule
    const { data: storedLines, error: linesError } = await db
      .from('fiscal_accounting_rule_lines')
      .select('*')
      .eq('rule_id', sourceRule.id)
      .eq('company_id', context.companyId)
      .order('line_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (linesError) throw linesError

    const sourceLines = storedLines?.length ? (storedLines as FiscalAccountingRuleLine[]) : legacyLinesFromRule(sourceRule)
    const copyInput: RuleInput = {
      name: copyRuleName(sourceRule.name),
      description: sourceRule.description || undefined,
      priority: Number(sourceRule.priority ?? 100),
      documentTypes: arrayWithFallback(sourceRule.document_types, sourceRule.document_type),
      directions: arrayWithFallback(sourceRule.directions, sourceRule.direction),
      cfops: arrayWithFallback(sourceRule.cfops, sourceRule.cfop),
      cfopPatterns: arrayWithFallback(sourceRule.cfop_patterns, sourceRule.cfop_pattern),
      fiscalOperationNatureIds: arrayWithFallback(sourceRule.fiscal_operation_nature_ids, sourceRule.fiscal_operation_nature_id),
      itemTypes: arrayWithFallback(sourceRule.item_types, sourceRule.item_type),
      partnerIds: arrayWithFallback(sourceRule.partner_ids, sourceRule.partner_id),
      taxRegimes: arrayWithFallback(sourceRule.tax_regimes, sourceRule.tax_regime),
      minAmount: sourceRule.min_amount !== null && sourceRule.min_amount !== undefined ? Number(sourceRule.min_amount) : undefined,
      maxAmount: sourceRule.max_amount !== null && sourceRule.max_amount !== undefined ? Number(sourceRule.max_amount) : undefined,
      descriptionTemplate: sourceRule.description_template || undefined,
      lines: linesInputFromStoredLines(sourceLines)
    }

    const { data: newRule, error: insertError } = await db
      .from('fiscal_accounting_rules')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        active: false,
        ...toRow(copyInput)
      })
      .select('id')
      .single()

    if (insertError || !newRule) throw insertError || new Error('Falha ao duplicar regra contábil fiscal.')

    try {
      await replaceRuleLines(db, context, newRule.id, copyInput.lines)
    } catch (lineError) {
      await db.from('fiscal_accounting_rules').delete().eq('id', newRule.id).eq('company_id', context.companyId)
      throw lineError
    }

    revalidatePath('/fiscal/regras-contabeis')
    return { ok: true, data: { id: newRule.id }, message: 'Regra duplicada como inativa para edição.' }
  } catch (error: unknown) {
    console.error('Erro ao duplicar regra contábil fiscal:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function toggleFiscalAccountingRuleActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; active: boolean }>> {
  if (!(await canPostFiscalToAccounting())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para administrar regras contábeis fiscais.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = toggleFiscalAccountingRuleActiveSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, active } = validation.data

  try {
    const { data, error } = await db
      .from('fiscal_accounting_rules')
      .update({ active })
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id, active')
      .single()

    if (error || !data) throw error || new Error('Falha ao alterar status da regra.')

    revalidatePath('/fiscal/regras-contabeis')
    return { ok: true, data: { id: data.id, active: data.active }, message: data.active ? 'Regra reativada.' : 'Regra desativada.' }
  } catch (error: unknown) {
    console.error('Erro ao alterar status da regra contábil fiscal:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function deleteFiscalAccountingRuleAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canPostFiscalToAccounting())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para administrar regras contábeis fiscais.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = deleteFiscalAccountingRuleSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const { count } = await db
      .from('fiscal_accounting_applications')
      .select('id', { count: 'exact', head: true })
      .eq('rule_id', validation.data.id)
      .eq('company_id', context.companyId)
    if (count && count > 0) {
      return { ok: false, error: 'Esta regra já foi usada em contabilizações — desative-a em vez de excluir, para preservar o rastro histórico.', code: 'RULE_IN_USE' }
    }

    const { error } = await db
      .from('fiscal_accounting_rules')
      .delete()
      .eq('id', validation.data.id)
      .eq('company_id', context.companyId)

    if (error) throw error

    revalidatePath('/fiscal/regras-contabeis')
    return { ok: true, data: { id: validation.data.id }, message: 'Regra excluída.' }
  } catch (error: unknown) {
    console.error('Erro ao excluir regra contábil fiscal:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
