'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageFiscal } from '@/lib/permissions/permissions'
import {
  createImportClassificationRuleSchema,
  updateImportClassificationRuleSchema,
  toggleImportClassificationRuleActiveSchema,
  deleteImportClassificationRuleSchema,
  CreateImportClassificationRuleInput
} from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function revalidateRules() {
  revalidatePath('/fiscal/configuracoes/regras-importacao')
}

function toRow(input: CreateImportClassificationRuleInput) {
  return {
    name: input.name,
    description: input.description || null,
    priority: input.priority,
    active: input.active ?? true,
    partner_id: input.partnerId || null,
    issuer_cnpj: input.issuerCnpj || null,
    xml_cfop_pattern: input.xmlCfopPattern || null,
    ncm_pattern: input.ncmPattern || null,
    cest: input.cest || null,
    item_id: input.itemId || null,
    supplier_product_code: input.supplierProductCode || null,
    supplier_description_pattern: input.supplierDescriptionPattern || null,
    document_type: input.documentType || null,
    direction: input.direction || null,
    origin_state: input.originState || null,
    destination_state: input.destinationState || null,
    municipality_code: input.municipalityCode || null,
    min_amount: input.minAmount ?? null,
    max_amount: input.maxAmount ?? null,
    fiscal_operation_nature_id: input.fiscalOperationNatureId || null,
    bookkeeping_cfop: input.bookkeepingCfop || null,
    tax_situation_code: input.taxSituationCode || null,
    item_fiscal_usage: input.itemFiscalUsage || null,
    item_kind: input.itemKind || null,
    generates_credit: input.generatesCredit ?? null,
    expected_retentions: input.expectedRetentions || [],
    create_partner_item_mapping: input.createPartnerItemMapping ?? false
  }
}

async function validateRuleReferences(db: any, companyId: string, input: CreateImportClassificationRuleInput): Promise<{ error: string; code: string } | null> {
  if (input.partnerId) {
    const { data, error } = await db.from('partners').select('id').eq('id', input.partnerId).eq('company_id', companyId).maybeSingle()
    if (error) throw error
    if (!data) return { error: 'O parceiro informado não existe ou pertence a outra empresa.', code: 'INVALID_PARTNER' }
  }

  if (input.itemId) {
    const { data, error } = await db.from('items').select('id').eq('id', input.itemId).eq('company_id', companyId).maybeSingle()
    if (error) throw error
    if (!data) return { error: 'O produto alvo informado não existe ou pertence a outra empresa.', code: 'INVALID_ITEM' }
  }

  if (input.fiscalOperationNatureId) {
    const { data, error } = await db.from('fiscal_operation_natures').select('id').eq('id', input.fiscalOperationNatureId).eq('company_id', companyId).maybeSingle()
    if (error) throw error
    if (!data) return { error: 'A natureza fiscal informada não existe ou pertence a outra empresa.', code: 'INVALID_FISCAL_NATURE' }
  }

  return null
}

export async function createImportClassificationRuleAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createImportClassificationRuleSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const referenceError = await validateRuleReferences(db, context.companyId, validation.data)
    if (referenceError) return { ok: false, error: referenceError.error, code: referenceError.code }

    const { data, error } = await db
      .from('fiscal_import_classification_rules')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        created_by: context.user.id,
        updated_by: context.user.id,
        ...toRow(validation.data)
      })
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao criar regra de importação.')

    revalidateRules()
    return { ok: true, data: { id: data.id }, message: 'Regra de importação criada.' }
  } catch (error: any) {
    console.error('Erro ao criar regra de importação XML:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateImportClassificationRuleAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateImportClassificationRuleSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...fields } = validation.data

  try {
    const referenceError = await validateRuleReferences(db, context.companyId, fields)
    if (referenceError) return { ok: false, error: referenceError.error, code: referenceError.code }

    const { data, error } = await db
      .from('fiscal_import_classification_rules')
      .update({ updated_by: context.user.id, ...toRow(fields) })
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao atualizar regra de importação.')

    revalidateRules()
    return { ok: true, data: { id: data.id }, message: 'Regra de importação atualizada.' }
  } catch (error: any) {
    console.error('Erro ao atualizar regra de importação XML:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function toggleImportClassificationRuleActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; active: boolean }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = toggleImportClassificationRuleActiveSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, active } = validation.data

  try {
    const { data, error } = await db
      .from('fiscal_import_classification_rules')
      .update({ active, updated_by: context.user.id })
      .eq('id', id)
      .eq('company_id', context.companyId)
      .select('id, active')
      .single()

    if (error || !data) throw error || new Error('Falha ao alterar status da regra.')

    revalidateRules()
    return { ok: true, data: { id: data.id, active: data.active }, message: data.active ? 'Regra ativada.' : 'Regra desativada.' }
  } catch (error: any) {
    console.error('Erro ao alterar status da regra de importação XML:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function deleteImportClassificationRuleAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = deleteImportClassificationRuleSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const { error } = await db
      .from('fiscal_import_classification_rules')
      .delete()
      .eq('id', validation.data.id)
      .eq('company_id', context.companyId)

    if (error) throw error

    revalidateRules()
    return { ok: true, data: { id: validation.data.id }, message: 'Regra de importação removida.' }
  } catch (error: any) {
    console.error('Erro ao remover regra de importação XML:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
