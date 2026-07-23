'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageRegistrations } from '@/lib/permissions/permissions'
import { createFiscalNatureSchema, updateFiscalNatureSchema, toggleFiscalNatureActiveSchema } from './validations'
import { DEFAULT_FISCAL_NATURE_SEED } from './labels'
import type { CreateFiscalNatureInput } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function toRow(input: CreateFiscalNatureInput) {
  return {
    code: input.code,
    name: input.name,
    direction: input.direction,
    description: input.description || null,
    operation_kind: input.operationKind || null,
    applicable_document_types: input.applicableDocumentTypes || [],
    fiscal_purpose: input.fiscalPurpose || null,
    default_bookkeeping_cfop: input.defaultBookkeepingCfop || null,
    default_tax_situation: input.defaultTaxSituation || null,
    icms_treatment: input.icmsTreatment || null,
    icms_st_treatment: input.icmsStTreatment || null,
    difal_applicable: input.difalApplicable ?? false,
    ipi_treatment: input.ipiTreatment || null,
    pis_cofins_treatment: input.pisCofinsTreatment || null,
    iss_treatment: input.issTreatment || null,
    expected_retentions: input.expectedRetentions || [],
    generates_credit: input.generatesCredit ?? false,
    enters_tax_assessment: input.entersTaxAssessment ?? true,
    triggers_accounting: input.triggersAccounting ?? true,
    suggested_accounting_rule_id: input.suggestedAccountingRuleId || null,
    requires_product: input.requiresProduct ?? false,
    requires_ncm: input.requiresNcm ?? false,
    item_nature_default: input.itemNatureDefault || null
  }
}

async function validateFiscalNatureReferences(db: any, companyId: string, input: CreateFiscalNatureInput): Promise<{ error: string; code: string } | null> {
  if (!input.suggestedAccountingRuleId) return null

  const { data, error } = await db
    .from('fiscal_accounting_rules')
    .select('id')
    .eq('id', input.suggestedAccountingRuleId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    return {
      error: 'A regra contábil fiscal sugerida não existe ou pertence a outra empresa.',
      code: 'INVALID_ACCOUNTING_RULE'
    }
  }

  return null
}

export async function createFiscalNatureAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createFiscalNatureSchema.safeParse(rawInput)
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
    const referenceError = await validateFiscalNatureReferences(db, context.companyId, validation.data)
    if (referenceError) return { ok: false, error: referenceError.error, code: referenceError.code }

    const { data, error } = await db
      .from('fiscal_operation_natures')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        is_active: true,
        ...toRow(validation.data)
      })
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return { ok: false, error: 'Já existe uma natureza fiscal com este código nesta empresa.', code: 'DUPLICATE_CODE' }
      }
      throw error || new Error('Falha ao criar natureza fiscal.')
    }

    revalidatePath('/cadastros/naturezas-fiscais')
    revalidatePath('/cadastros')

    return { ok: true, data: { id: data.id }, message: 'Natureza fiscal criada com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao criar natureza fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateFiscalNatureAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateFiscalNatureSchema.safeParse(rawInput)
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
    const referenceError = await validateFiscalNatureReferences(db, context.companyId, fields)
    if (referenceError) return { ok: false, error: referenceError.error, code: referenceError.code }

    const { data, error } = await db
      .from('fiscal_operation_natures')
      .update(toRow(fields))
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return { ok: false, error: 'Já existe uma natureza fiscal com este código nesta empresa.', code: 'DUPLICATE_CODE' }
      }
      throw error || new Error('Falha ao atualizar natureza fiscal.')
    }

    revalidatePath('/cadastros/naturezas-fiscais')
    revalidatePath('/cadastros')

    return { ok: true, data: { id: data.id }, message: 'Natureza fiscal atualizada com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao atualizar natureza fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function toggleFiscalNatureActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = toggleFiscalNatureActiveSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, isActive } = validation.data

  try {
    const { data, error } = await db
      .from('fiscal_operation_natures')
      .update({ is_active: isActive })
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id, is_active')
      .single()

    if (error || !data) {
      throw error || new Error('Falha ao alterar status da natureza fiscal.')
    }

    revalidatePath('/cadastros/naturezas-fiscais')
    revalidatePath('/cadastros')

    return {
      ok: true,
      data: { id: data.id, isActive: data.is_active },
      message: data.is_active ? 'Natureza fiscal reativada.' : 'Natureza fiscal inativada.'
    }
  } catch (error: any) {
    console.error('Erro ao alterar status da natureza fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

/**
 * Etapa 35B.1-A: fiscal_operation_natures é por empresa (unique(company_id, code)) — não faz
 * sentido inserir um seed global via migration sem contexto de empresa. Esta action cria as
 * 10 naturezas fiscais padrão da especificação (docs/especificacao-fluxo-fiscal-operacional-
 * 35b1.md, Seção 8) para a empresa ATIVA, sob demanda do usuário (botão na tela de Naturezas
 * Fiscais) — idempotente por (company_id, code): naturezas já existentes com o mesmo código
 * não são duplicadas nem sobrescritas.
 */
export async function seedDefaultFiscalNaturesAction(): Promise<ActionResult<{ created: number; skipped: number }>> {
  const canManage = await canManageRegistrations()
  if (!canManage) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar cadastros.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const { data: existing } = await db
      .from('fiscal_operation_natures')
      .select('code')
      .eq('company_id', context.companyId)
      .in('code', DEFAULT_FISCAL_NATURE_SEED.map((n) => n.code))

    const existingCodes = new Set((existing || []).map((n: { code: string }) => n.code))
    const toCreate = DEFAULT_FISCAL_NATURE_SEED.filter((n) => !existingCodes.has(n.code))

    if (toCreate.length === 0) {
      return { ok: true, data: { created: 0, skipped: DEFAULT_FISCAL_NATURE_SEED.length }, message: 'Todas as naturezas fiscais padrão já existem nesta empresa.' }
    }

    const { error } = await db.from('fiscal_operation_natures').insert(
      toCreate.map((n) => ({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        code: n.code,
        name: n.name,
        direction: n.direction,
        operation_kind: n.operationKind,
        is_active: true
      }))
    )
    if (error) throw error

    revalidatePath('/cadastros/naturezas-fiscais')
    revalidatePath('/cadastros')

    return {
      ok: true,
      data: { created: toCreate.length, skipped: DEFAULT_FISCAL_NATURE_SEED.length - toCreate.length },
      message: `${toCreate.length} natureza(s) fiscal(is) padrão criada(s). Ajuste os campos de comportamento (CFOP/CST/tratamentos) conforme a realidade da empresa.`
    }
  } catch (error: any) {
    console.error('Erro ao criar naturezas fiscais padrão:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
