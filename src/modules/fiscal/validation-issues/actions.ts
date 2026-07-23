'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageFiscal } from '@/lib/permissions/permissions'
import { setValidationIssueStatusSchema } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function revalidatePendencies(fiscalDocumentId?: string) {
  revalidatePath('/fiscal/pendencias')
  revalidatePath('/fiscal/documentos')
  if (fiscalDocumentId) revalidatePath(`/fiscal/documentos/${fiscalDocumentId}`)
}

/**
 * Etapa 35B: a maioria das pendencias da central e calculada dinamicamente (ver rules.ts) —
 * "ignorar"/"marcar resolvida" so precisam persistir uma linha em
 * fiscal_document_validation_issues quando ainda nao existe uma para esta combinacao
 * (documento, item, tipo). Select-then-insert/update explicito (nao upsert com onConflict)
 * pelo mesmo motivo documentado na 35A: o indice que garante unicidade aqui e funcional
 * (coalesce), que o shorthand de upsert do Supabase nao consegue casar.
 */
async function setIssueStatus(rawInput: unknown, status: 'IGNORED' | 'RESOLVED'): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = setValidationIssueStatusSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { fiscalDocumentId, fiscalDocumentItemId, issueType, severity, message } = validation.data

  try {
    const { data: doc } = await db.from('fiscal_documents').select('id').eq('id', fiscalDocumentId).eq('company_id', context.companyId).maybeSingle()
    if (!doc) return { ok: false, error: 'Documento fiscal não encontrado.', code: 'NOT_FOUND' }

    if (fiscalDocumentItemId) {
      const { data: item } = await db.from('fiscal_document_items').select('id').eq('id', fiscalDocumentItemId).eq('fiscal_document_id', fiscalDocumentId).eq('company_id', context.companyId).maybeSingle()
      if (!item) return { ok: false, error: 'Item do documento fiscal não encontrado.', code: 'NOT_FOUND' }
    }

    let existingQuery = db
      .from('fiscal_document_validation_issues')
      .select('id')
      .eq('company_id', context.companyId)
      .eq('fiscal_document_id', fiscalDocumentId)
      .eq('issue_type', issueType)
    existingQuery = fiscalDocumentItemId ? existingQuery.eq('fiscal_document_item_id', fiscalDocumentItemId) : existingQuery.is('fiscal_document_item_id', null)
    const { data: existing } = await existingQuery.maybeSingle()

    const nowIso = new Date().toISOString()

    if (existing) {
      const { error } = await db
        .from('fiscal_document_validation_issues')
        .update({ status, message, severity, resolved_at: nowIso, resolved_by: context.user.id })
        .eq('id', existing.id)
        .eq('company_id', context.companyId)
      if (error) throw error
      revalidatePendencies(fiscalDocumentId)
      return { ok: true, data: { id: existing.id }, message: status === 'IGNORED' ? 'Pendência ignorada.' : 'Pendência marcada como resolvida.' }
    }

    const { data: created, error } = await db
      .from('fiscal_document_validation_issues')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        fiscal_document_id: fiscalDocumentId,
        fiscal_document_item_id: fiscalDocumentItemId || null,
        issue_type: issueType,
        severity,
        message,
        source: 'MANUAL',
        status,
        resolved_at: nowIso,
        resolved_by: context.user.id
      })
      .select('id')
      .single()

    if (error || !created) throw error || new Error('Falha ao registrar a pendência.')

    revalidatePendencies(fiscalDocumentId)
    return { ok: true, data: { id: created.id }, message: status === 'IGNORED' ? 'Pendência ignorada.' : 'Pendência marcada como resolvida.' }
  } catch (error: any) {
    console.error('Erro ao atualizar pendência fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function ignoreValidationIssueAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  return setIssueStatus(rawInput, 'IGNORED')
}

export async function resolveValidationIssueAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  return setIssueStatus(rawInput, 'RESOLVED')
}
