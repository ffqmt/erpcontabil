'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageFiscal } from '@/lib/permissions/permissions'
import { linkReviewIssueToItemSchema, createItemAndResolveReviewIssueSchema, ignoreReviewIssueSchema } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function revalidateReviewQueue(fiscalDocumentId?: string) {
  revalidatePath('/fiscal/revisao-itens')
  revalidatePath('/fiscal/documentos')
  revalidatePath('/fiscal/pendencias')
  if (fiscalDocumentId) revalidatePath(`/fiscal/documentos/${fiscalDocumentId}`)
}

async function loadOpenIssue(db: any, issueId: string, companyId: string): Promise<{ error: string; code: string } | { issue: any }> {
  const { data: issue } = await db
    .from('fiscal_document_item_review_issues')
    .select('*')
    .eq('id', issueId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!issue) return { error: 'Pendência não encontrada.', code: 'NOT_FOUND' }
  if (issue.status !== 'OPEN') return { error: 'Esta pendência já foi resolvida ou ignorada.', code: 'ALREADY_RESOLVED' }
  return { issue }
}

/**
 * Vincula manualmente o item do documento fiscal a um produto já existente do catálogo, e
 * — se a pendência veio com um código de produto do fornecedor (supplierProductCode) —
 * grava/atualiza o mapeamento em partner_item_mappings, para que a PRÓXIMA importação do
 * mesmo fornecedor com o mesmo código já case automaticamente.
 */
export async function linkReviewIssueToItemAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = linkReviewIssueToItemSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { issueId, itemId } = validation.data

  try {
    const loaded = await loadOpenIssue(db, issueId, context.companyId)
    if ('error' in loaded) return { ok: false, error: loaded.error, code: loaded.code }
    const issue = loaded.issue

    const { data: item } = await db.from('items').select('id, company_id').eq('id', itemId).single()
    if (!item || item.company_id !== context.companyId) {
      return { ok: false, error: 'O produto informado não existe ou pertence a outra empresa.', code: 'INVALID_ITEM' }
    }

    const { error: updateItemError } = await db
      .from('fiscal_document_items')
      .update({ item_id: itemId })
      .eq('id', issue.fiscal_document_item_id)
      .eq('company_id', context.companyId)
      .select('id')
      .single()

    if (updateItemError) throw updateItemError

    const supplierProductCode: string | null = issue.details?.supplierProductCode || null
    const partnerId: string | null = issue.details?.partnerId || null

    if (supplierProductCode && partnerId) {
      const { data: partner } = await db.from('partners').select('id, company_id').eq('id', partnerId).eq('company_id', context.companyId).maybeSingle()
      if (!partner) {
        return { ok: false, error: 'O parceiro vinculado à pendência não existe ou pertence a outra empresa.', code: 'INVALID_PARTNER' }
      }

      // Select-then-insert/update explícito em vez de .upsert(onConflict): o índice único
      // de partner_item_mappings é parcial (where supplier_product_code is not null and
      // active), e a
      // API simplificada de upsert do Supabase não casa com índice parcial via onConflict.
      const { data: existingMapping } = await db
        .from('partner_item_mappings')
        .select('id')
        .eq('company_id', context.companyId)
        .eq('partner_id', partnerId)
        .eq('supplier_product_code', supplierProductCode)
        .eq('active', true)
        .maybeSingle()

      if (existingMapping) {
        const { error: mappingUpdateError } = await db
          .from('partner_item_mappings')
          .update({ item_id: itemId, source: 'MANUAL', active: true })
          .eq('id', existingMapping.id)
          .eq('company_id', context.companyId)
        if (mappingUpdateError) throw mappingUpdateError
      } else {
        const { error: mappingInsertError } = await db.from('partner_item_mappings').insert({
          workspace_id: context.workspaceId,
          company_id: context.companyId,
          partner_id: partnerId,
          item_id: itemId,
          supplier_product_code: supplierProductCode,
          source: 'MANUAL',
          active: true
        })
        if (mappingInsertError) throw mappingInsertError
      }
    }

    const { error: issueUpdateError } = await db
      .from('fiscal_document_item_review_issues')
      .update({ status: 'RESOLVED', resolved_at: new Date().toISOString(), resolved_by: context.user.id })
      .eq('id', issueId)
      .eq('company_id', context.companyId)
      .select('id')
      .single()
    if (issueUpdateError) throw issueUpdateError

    revalidateReviewQueue(issue.fiscal_document_id)
    return { ok: true, data: { id: issueId }, message: 'Item vinculado ao produto.' }
  } catch (error: any) {
    console.error('Erro ao vincular item importado a produto:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

/**
 * Criação assistida: cria um produto novo no catálogo a partir do item importado e já
 * resolve a pendência vinculando-o — evita o usuário ter que ir para outra tela.
 */
export async function createItemAndResolveReviewIssueAction(rawInput: unknown): Promise<ActionResult<{ itemId: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createItemAndResolveReviewIssueSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { issueId, code, name, itemType, unit, ncm } = validation.data

  try {
    const loaded = await loadOpenIssue(db, issueId, context.companyId)
    if ('error' in loaded) return { ok: false, error: loaded.error, code: loaded.code }
    const issue = loaded.issue

    const { data: newItem, error: createError } = await db
      .from('items')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        code,
        name,
        item_type: itemType,
        unit: unit || null,
        ncm: ncm || null,
        active: true
      })
      .select('id')
      .single()

    if (createError || !newItem) {
      if (createError?.code === '23505') {
        return { ok: false, error: 'Já existe um produto com este código nesta empresa.', code: 'DUPLICATE_CODE' }
      }
      throw createError || new Error('Falha ao criar produto.')
    }

    const linkResult = await linkReviewIssueToItemAction({ issueId, itemId: newItem.id })
    if (!linkResult.ok) {
      return { ok: false, error: `Produto criado, mas falhou ao vincular: ${linkResult.error}`, code: linkResult.code }
    }

    return { ok: true, data: { itemId: newItem.id }, message: 'Produto criado e item vinculado.' }
  } catch (error: any) {
    console.error('Erro ao criar produto a partir de item importado:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function ignoreReviewIssueAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = ignoreReviewIssueSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { issueId } = validation.data

  try {
    const loaded = await loadOpenIssue(db, issueId, context.companyId)
    if ('error' in loaded) return { ok: false, error: loaded.error, code: loaded.code }
    const issue = loaded.issue

    const { error: issueUpdateError } = await db
      .from('fiscal_document_item_review_issues')
      .update({ status: 'IGNORED', resolved_at: new Date().toISOString(), resolved_by: context.user.id })
      .eq('id', issueId)
      .eq('company_id', context.companyId)
      .select('id')
      .single()
    if (issueUpdateError) throw issueUpdateError

    revalidateReviewQueue(issue.fiscal_document_id)
    return { ok: true, data: { id: issueId }, message: 'Pendência ignorada.' }
  } catch (error: any) {
    console.error('Erro ao ignorar pendência de item importado:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
