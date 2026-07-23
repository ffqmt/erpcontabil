'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageFiscal, canPostFiscalToAccounting } from '@/lib/permissions/permissions'
import { createLinkedAccountForRole } from '@/modules/registrations/partners/actions'
import { reverseJournalEntryAction } from '@/modules/accounting/journal/actions'
import { AccountSource, DebitCredit, FiscalAccountingRule, FiscalAccountingRuleLine } from './accounting-rules/types'
import { legacyLinesFromRule, renderAccountingMemo, roundCurrency, valueBaseAmount } from './accounting-rules/utils'
import {
  createFiscalDocumentSchema,
  updateFiscalDocumentSchema,
  fiscalDocumentIdSchema,
  bulkFiscalDocumentWorkflowSchema,
  bulkFiscalDocumentAccountingSchema,
  cancelFiscalDocumentSchema,
  createFiscalDocumentItemSchema,
  updateFiscalDocumentItemSchema,
  deleteFiscalDocumentItemSchema,
  upsertFiscalDocumentRetentionsSchema,
  accountFiscalDocumentSchema,
  reverseFiscalDocumentAccountingSchema,
  regenerateFiscalDocumentAccountingSchema
} from './validations'
import { EDITABLE_FISCAL_STATUSES } from './utils'
import { findFiscalAccountingRuleForDocument } from './accounting-rules/queries'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

export type BulkFiscalDocumentWorkflowFailure = {
  id: string
  label: string
  reason: string
}

export type BulkFiscalDocumentWorkflowResult = {
  operation: 'VALIDATE' | 'BOOK' | 'ACCOUNT' | 'REGENERATE'
  requested: number
  succeeded: number
  failed: BulkFiscalDocumentWorkflowFailure[]
}

async function getDb() {
  return getClient()
}

function revalidateFiscal(id?: string) {
  revalidatePath('/fiscal')
  revalidatePath('/fiscal/documentos')
  revalidatePath('/fiscal/pendencias')
  if (id) revalidatePath(`/fiscal/documentos/${id}`)
}

function competenceFirstDay(dateStr: string) {
  const parts = dateStr.split('-')
  return `${parts[0]}-${parts[1]}-01`
}

function docRow(input: any) {
  return {
    partner_id: input.partnerId,
    fiscal_operation_nature_id: input.fiscalOperationNatureId || null,
    direction: input.direction,
    document_type: input.documentType,
    operation_type: input.operationType || null,
    // Bug pré-existente corrigido na Etapa 32B: a coluna real em fiscal_documents é
    // "number" (schema original, erp_schema_v1_1.sql) — "document_number" nunca existiu
    // nesta tabela (só em bank_statement_lines, Etapa 18). Todo INSERT/UPDATE manual de
    // documento fiscal falhava silenciosamente com "column does not exist" antes desta
    // correção.
    number: input.documentNumber || null,
    series: input.series || null,
    access_key: input.accessKey || null,
    issue_date: input.issueDate,
    operation_date: input.operationDate,
    competence: competenceFirstDay(input.operationDate),
    document_amount: input.documentAmount,
    merchandise_amount: input.merchandiseAmount ?? null,
    services_amount: input.servicesAmount ?? null,
    freight_amount: input.freightAmount ?? null,
    insurance_amount: input.insuranceAmount ?? null,
    discount_amount: input.discountAmount ?? null,
    other_expenses_amount: input.otherExpensesAmount ?? null,
    icms_base: input.icmsBase ?? null,
    icms_rate: input.icmsRate ?? null,
    icms_amount: input.icmsAmount ?? null,
    iss_base: input.issBase ?? null,
    iss_rate: input.issRate ?? null,
    iss_amount: input.issAmount ?? null,
    pis_base: input.pisBase ?? null,
    pis_rate: input.pisRate ?? null,
    pis_amount: input.pisAmount ?? null,
    cofins_base: input.cofinsBase ?? null,
    cofins_rate: input.cofinsRate ?? null,
    cofins_amount: input.cofinsAmount ?? null,
    notes: input.notes || null
  }
}

// =====================================================================================
// CRUD DE DOCUMENTO
// =====================================================================================

export async function createFiscalDocumentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createFiscalDocumentSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const { data: partner } = await db.from('partners').select('id, company_id').eq('id', validation.data.partnerId).single()
    if (!partner || partner.company_id !== context.companyId) {
      return { ok: false, error: 'O parceiro informado não existe ou pertence a outra empresa.', code: 'INVALID_PARTNER' }
    }

    if (validation.data.fiscalOperationNatureId) {
      const { data: nature } = await db.from('fiscal_operation_natures').select('id, company_id').eq('id', validation.data.fiscalOperationNatureId).single()
      if (!nature || nature.company_id !== context.companyId) {
        return { ok: false, error: 'A natureza fiscal informada não existe ou pertence a outra empresa.', code: 'INVALID_FISCAL_NATURE' }
      }
    }

    const { data, error } = await db
      .from('fiscal_documents')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        status: 'DRAFT',
        accounting_status: 'NOT_ACCOUNTED',
        tax_status: 'NOT_ASSESSED',
        source: 'MANUAL',
        ...docRow(validation.data)
      })
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao criar documento fiscal.')

    revalidateFiscal()
    return { ok: true, data: { id: data.id }, message: 'Documento fiscal criado como rascunho.' }
  } catch (error: any) {
    console.error('Erro ao criar documento fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateFiscalDocumentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateFiscalDocumentSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...fields } = validation.data

  try {
    const { data: existing } = await db.from('fiscal_documents').select('status').eq('id', id).eq('company_id', context.companyId).single()
    if (!existing) return { ok: false, error: 'Documento fiscal não encontrado.', code: 'NOT_FOUND' }
    if (!EDITABLE_FISCAL_STATUSES.includes(existing.status)) {
      return { ok: false, error: `Documento no status ${existing.status} não pode ser editado.`, code: 'INVALID_STATUS' }
    }

    if (fields.fiscalOperationNatureId) {
      const { data: nature } = await db.from('fiscal_operation_natures').select('id, company_id').eq('id', fields.fiscalOperationNatureId).single()
      if (!nature || nature.company_id !== context.companyId) {
        return { ok: false, error: 'A natureza fiscal informada não existe ou pertence a outra empresa.', code: 'INVALID_FISCAL_NATURE' }
      }
    }

    const { error } = await db.from('fiscal_documents').update(docRow(fields)).eq('id', id).eq('company_id', context.companyId)
    if (error) throw error

    revalidateFiscal(id)
    return { ok: true, data: { id }, message: 'Documento fiscal atualizado.' }
  } catch (error: any) {
    console.error('Erro ao atualizar documento fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function cancelFiscalDocumentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = cancelFiscalDocumentSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Informe uma justificativa válida.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, reason } = validation.data

  try {
    const { data: existing } = await db.from('fiscal_documents').select('status, journal_entry_id, notes').eq('id', id).eq('company_id', context.companyId).single()
    if (!existing) return { ok: false, error: 'Documento fiscal não encontrado.', code: 'NOT_FOUND' }
    if (existing.status === 'CANCELLED') return { ok: false, error: 'Documento já está cancelado.', code: 'ALREADY_CANCELLED' }
    if (existing.journal_entry_id) {
      return { ok: false, error: 'Documento já contabilizado — estorne o lançamento contábil em Lançamentos antes de cancelar.', code: 'ALREADY_ACCOUNTED' }
    }

    const { error } = await db
      .from('fiscal_documents')
      .update({ status: 'CANCELLED', tax_status: 'IGNORED', notes: [existing.notes, `Cancelado: ${reason}`].filter(Boolean).join(' | ') })
      .eq('id', id)
      .eq('company_id', context.companyId)

    if (error) throw error

    revalidateFiscal(id)
    return { ok: true, data: { id }, message: 'Documento fiscal cancelado.' }
  } catch (error: any) {
    console.error('Erro ao cancelar documento fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function validateFiscalDocumentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = fiscalDocumentIdSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id } = validation.data

  try {
    const { data: existing } = await db.from('fiscal_documents').select('status').eq('id', id).eq('company_id', context.companyId).single()
    if (!existing) return { ok: false, error: 'Documento fiscal não encontrado.', code: 'NOT_FOUND' }
    if (existing.status !== 'DRAFT' && existing.status !== 'IMPORTED') {
      return { ok: false, error: `Só é possível validar documentos em Rascunho/Importado (status atual: ${existing.status}).`, code: 'INVALID_STATUS' }
    }

    const { count } = await db.from('fiscal_document_items').select('id', { count: 'exact', head: true }).eq('fiscal_document_id', id).eq('company_id', context.companyId)
    if (!count || count === 0) {
      return { ok: false, error: 'O documento precisa de pelo menos 1 item para ser validado.', code: 'NO_ITEMS' }
    }

    const { error } = await db.from('fiscal_documents').update({ status: 'VALIDATED' }).eq('id', id).eq('company_id', context.companyId)
    if (error) throw error

    revalidateFiscal(id)
    return { ok: true, data: { id }, message: 'Documento fiscal validado.' }
  } catch (error: any) {
    console.error('Erro ao validar documento fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function bookFiscalDocumentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = fiscalDocumentIdSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id } = validation.data

  try {
    const { data: existing } = await db.from('fiscal_documents').select('status').eq('id', id).eq('company_id', context.companyId).single()
    if (!existing) return { ok: false, error: 'Documento fiscal não encontrado.', code: 'NOT_FOUND' }
    if (existing.status !== 'VALIDATED') {
      return { ok: false, error: `Só é possível escriturar documentos Validados (status atual: ${existing.status}).`, code: 'INVALID_STATUS' }
    }

    const { error } = await db.from('fiscal_documents').update({ status: 'BOOKED' }).eq('id', id).eq('company_id', context.companyId)
    if (error) throw error

    revalidateFiscal(id)
    return { ok: true, data: { id }, message: 'Documento fiscal escriturado com sucesso.' }
  } catch (error: any) {
    console.error('Erro ao escriturar documento fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

function fiscalDocumentLabel(doc: { number?: string | null; id: string }) {
  return doc.number ? `Documento nº ${doc.number}` : `Documento ${doc.id.slice(0, 8)}`
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize))
  }
  return chunks
}

export async function bulkFiscalDocumentWorkflowAction(rawInput: unknown): Promise<ActionResult<BulkFiscalDocumentWorkflowResult>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = bulkFiscalDocumentWorkflowSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Seleção inválida para processamento em lote.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const ids = Array.from(new Set(validation.data.ids))
  const operation = validation.data.operation
  const failed: BulkFiscalDocumentWorkflowFailure[] = []

  try {
    const docs: { id: string; number: string | null; status: string }[] = []
    for (const chunk of chunkArray(ids, 200)) {
      const { data, error } = await db
        .from('fiscal_documents')
        .select('id, number, status')
        .eq('company_id', context.companyId)
        .in('id', chunk)

      if (error) throw error
      docs.push(...((data || []) as { id: string; number: string | null; status: string }[]))
    }

    const byId = new Map(docs.map((doc) => [doc.id, doc]))
    const candidates: string[] = []

    for (const id of ids) {
      const doc = byId.get(id)
      if (!doc) {
        failed.push({ id, label: `Documento ${id.slice(0, 8)}`, reason: 'Documento não encontrado nesta empresa.' })
        continue
      }

      if (operation === 'VALIDATE') {
        if (doc.status !== 'DRAFT' && doc.status !== 'IMPORTED') {
          failed.push({ id, label: fiscalDocumentLabel(doc), reason: `Status atual ${doc.status}; só rascunho/importado pode ser validado.` })
          continue
        }
      } else if (doc.status !== 'VALIDATED') {
        failed.push({ id, label: fiscalDocumentLabel(doc), reason: `Status atual ${doc.status}; só validado pode ser escriturado.` })
        continue
      }

      candidates.push(id)
    }

    let validIds = candidates

    if (operation === 'VALIDATE' && candidates.length > 0) {
      const items: { fiscal_document_id: string }[] = []
      for (const chunk of chunkArray(candidates, 200)) {
        const { data, error: itemsError } = await db
          .from('fiscal_document_items')
          .select('fiscal_document_id')
          .in('fiscal_document_id', chunk)
          .eq('company_id', context.companyId)

        if (itemsError) throw itemsError
        items.push(...((data || []) as { fiscal_document_id: string }[]))
      }

      const docsWithItems = new Set(items.map((item) => item.fiscal_document_id))
      validIds = candidates.filter((id) => {
        if (docsWithItems.has(id)) return true
        const doc = byId.get(id)
        failed.push({ id, label: doc ? fiscalDocumentLabel(doc) : `Documento ${id.slice(0, 8)}`, reason: 'Documento sem itens fiscais.' })
        return false
      })
    }

    if (validIds.length > 0) {
      const nextStatus = operation === 'VALIDATE' ? 'VALIDATED' : 'BOOKED'
      for (const chunk of chunkArray(validIds, 200)) {
        const { error: updateError } = await db
          .from('fiscal_documents')
          .update({ status: nextStatus })
          .eq('company_id', context.companyId)
          .in('id', chunk)

        if (updateError) throw updateError
      }
    }

    revalidateFiscal()

    const actionLabel = operation === 'VALIDATE' ? 'validados' : 'escriturados'
    return {
      ok: true,
      data: {
        operation,
        requested: ids.length,
        succeeded: validIds.length,
        failed
      },
      message: `${validIds.length} documento(s) ${actionLabel}.`
    }
  } catch (error: unknown) {
    console.error('Erro ao processar documentos fiscais em lote:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// ITENS DO DOCUMENTO
// =====================================================================================

async function assertDocumentEditable(db: any, fiscalDocumentId: string, companyId: string) {
  const { data: doc } = await db.from('fiscal_documents').select('status').eq('id', fiscalDocumentId).eq('company_id', companyId).single()
  if (!doc) return 'Documento fiscal não encontrado.'
  if (!EDITABLE_FISCAL_STATUSES.includes(doc.status)) return `Documento no status ${doc.status} não aceita alteração de itens.`
  return null
}

function itemRow(input: any) {
  return {
    item_id: input.itemId || null,
    line_number: input.lineNumber ?? null,
    description: input.description,
    item_type: input.itemType,
    quantity: input.quantity,
    unit: input.unit || null,
    unit_amount: input.unitPrice ?? null,
    total_amount: input.totalAmount,
    ncm: input.ncm || null,
    cfop: input.cfop || null,
    service_code: input.serviceCode || null,
    icms_amount: input.icmsAmount ?? null,
    ipi_amount: input.ipiAmount ?? null,
    pis_amount: input.pisAmount ?? null,
    cofins_amount: input.cofinsAmount ?? null,
    iss_amount: input.issAmount ?? null,
    notes: input.notes || null
  }
}

export async function createFiscalDocumentItemAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createFiscalDocumentItemSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do item.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const editErr = await assertDocumentEditable(db, validation.data.fiscalDocumentId, context.companyId)
    if (editErr) return { ok: false, error: editErr, code: 'INVALID_STATUS' }

    if (validation.data.itemId) {
      const { data: catalogItem } = await db.from('items').select('id, company_id').eq('id', validation.data.itemId).single()
      if (!catalogItem || catalogItem.company_id !== context.companyId) {
        return { ok: false, error: 'O item de catálogo informado não existe ou pertence a outra empresa.', code: 'INVALID_ITEM' }
      }
    }

    const { data, error } = await db
      .from('fiscal_document_items')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        fiscal_document_id: validation.data.fiscalDocumentId,
        ...itemRow(validation.data)
      })
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao criar item do documento fiscal.')

    revalidateFiscal(validation.data.fiscalDocumentId)
    return { ok: true, data: { id: data.id }, message: 'Item adicionado.' }
  } catch (error: any) {
    console.error('Erro ao criar item de documento fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateFiscalDocumentItemAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateFiscalDocumentItemSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do item.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...fields } = validation.data

  try {
    const editErr = await assertDocumentEditable(db, fields.fiscalDocumentId, context.companyId)
    if (editErr) return { ok: false, error: editErr, code: 'INVALID_STATUS' }

    if (fields.itemId) {
      const { data: catalogItem } = await db.from('items').select('id, company_id').eq('id', fields.itemId).single()
      if (!catalogItem || catalogItem.company_id !== context.companyId) {
        return { ok: false, error: 'O item de catálogo informado não existe ou pertence a outra empresa.', code: 'INVALID_ITEM' }
      }
    }

    const { error } = await db
      .from('fiscal_document_items')
      .update(itemRow(fields))
      .eq('id', id)
      .eq('fiscal_document_id', fields.fiscalDocumentId)
      .eq('company_id', context.companyId)
    if (error) throw error

    revalidateFiscal(fields.fiscalDocumentId)
    return { ok: true, data: { id }, message: 'Item atualizado.' }
  } catch (error: any) {
    console.error('Erro ao atualizar item de documento fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function deleteFiscalDocumentItemAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = deleteFiscalDocumentItemSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, fiscalDocumentId } = validation.data

  try {
    const editErr = await assertDocumentEditable(db, fiscalDocumentId, context.companyId)
    if (editErr) return { ok: false, error: editErr, code: 'INVALID_STATUS' }

    const { error } = await db
      .from('fiscal_document_items')
      .delete()
      .eq('id', id)
      .eq('fiscal_document_id', fiscalDocumentId)
      .eq('company_id', context.companyId)
    if (error) throw error

    revalidateFiscal(fiscalDocumentId)
    return { ok: true, data: { id }, message: 'Item removido.' }
  } catch (error: any) {
    console.error('Erro ao remover item de documento fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// RETENÇÕES (substitui a lista inteira a cada chamada — mais simples que CRUD por linha)
// =====================================================================================

export async function upsertFiscalDocumentRetentionsAction(rawInput: unknown): Promise<ActionResult<{ count: number }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = upsertFiscalDocumentRetentionsSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nas retenções.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { fiscalDocumentId, retentions } = validation.data

  try {
    const editErr = await assertDocumentEditable(db, fiscalDocumentId, context.companyId)
    if (editErr) return { ok: false, error: editErr, code: 'INVALID_STATUS' }

    const { error: deleteError } = await db.from('fiscal_document_retentions').delete().eq('fiscal_document_id', fiscalDocumentId).eq('company_id', context.companyId)
    if (deleteError) throw deleteError

    if (retentions.length > 0) {
      const rows = retentions.map((r) => ({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        fiscal_document_id: fiscalDocumentId,
        tax_type: r.taxType,
        base_amount: r.baseAmount,
        rate: r.rate ?? null,
        amount: r.amount,
        withheld_by_partner: r.withheldByPartner,
        notes: r.notes || null
      }))
      const { error } = await db.from('fiscal_document_retentions').insert(rows)
      if (error) throw error
    }

    revalidateFiscal(fiscalDocumentId)
    return { ok: true, data: { count: retentions.length }, message: 'Retenções salvas.' }
  } catch (error: any) {
    console.error('Erro ao salvar retenções do documento fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// ETAPA 21 (base) + 32C (regras/rastro) — FISCAL -> CONTABILIDADE
// =====================================================================================

/**
 * Resolve a conta de um lado (débito/crédito) de uma regra contábil fiscal NO MOMENTO DE
 * CONTABILIZAR (diferente da resolução só-leitura da prévia): se a conta dinâmica de
 * parceiro (cliente/fornecedor) ainda não existir, cria/reaproveita usando exatamente a
 * mesma lógica já usada pelo cadastro manual de parceiros e pela importação de XML
 * (createLinkedAccountForRole) — nunca duplica parceiro nem conta, nunca remove o papel
 * oposto (cliente/fornecedor) que o parceiro já tivesse.
 */
async function resolveRuleAccountForExecution(
  db: any,
  companyId: string,
  workspaceId: string,
  source: AccountSource,
  fixedAccountId: string | null,
  partnerId: string | null
): Promise<{ accountId: string } | { error: string }> {
  if (source === 'FIXED') {
    if (!fixedAccountId) return { error: 'A regra não tem conta fixa configurada para este lado do lançamento.' }
    return { accountId: fixedAccountId }
  }

  if (!partnerId) return { error: 'Documento sem parceiro vinculado — não é possível resolver a conta dinâmica da regra.' }

  const role: 'customer' | 'supplier' = source === 'PARTNER_CUSTOMER' ? 'customer' : 'supplier'
  const column = source === 'PARTNER_CUSTOMER' ? 'customer_account_id' : 'supplier_account_id'

  const { data: partner } = await db.from('partners').select(`id, name, is_customer, is_supplier, ${column}`).eq('id', partnerId).eq('company_id', companyId).single()
  if (!partner) return { error: 'Parceiro do documento não encontrado.' }
  if (partner[column]) return { accountId: partner[column] as string }

  const accResult = await createLinkedAccountForRole(db, companyId, workspaceId, role, partner.name)
  if ('error' in accResult) return { error: `Falha ao criar automaticamente a conta de ${role === 'customer' ? 'cliente' : 'fornecedor'}: ${accResult.error}` }

  const patch: Record<string, unknown> = { [column]: accResult.id }
  if (role === 'customer' && !partner.is_customer) patch.is_customer = true
  if (role === 'supplier' && !partner.is_supplier) patch.is_supplier = true
  await db.from('partners').update(patch).eq('id', partnerId).eq('company_id', companyId)

  return { accountId: accResult.id }
}

type PreparedJournalLine = {
  accountId: string
  debitCredit: DebitCredit
  amount: number
  memo: string
}

async function loadRuleLinesForExecution(db: any, rule: FiscalAccountingRule): Promise<FiscalAccountingRuleLine[]> {
  const { data, error } = await db
    .from('fiscal_accounting_rule_lines')
    .select('*')
    .eq('rule_id', rule.id)
    .eq('company_id', rule.company_id)
    .order('line_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  if (data?.length) return data as FiscalAccountingRuleLine[]
  return legacyLinesFromRule(rule)
}

async function prepareRuleJournalLines(
  db: any,
  context: { companyId: string; workspaceId: string },
  rule: FiscalAccountingRule,
  doc: any
): Promise<
  | { lines: PreparedJournalLine[]; debitTotal: number; creditTotal: number; description: string }
  | { error: string; code: string }
> {
  const ruleLines = await loadRuleLinesForExecution(db, rule)
  const fallbackDescription = `Documento fiscal ${doc.number || doc.id} — contabilizado pela regra "${rule.name}"`
  const description = renderAccountingMemo(rule.description_template, doc, fallbackDescription)
  const lines: PreparedJournalLine[] = []

  for (const line of ruleLines) {
    const resolved = await resolveRuleAccountForExecution(db, context.companyId, context.workspaceId, line.account_source, line.account_id, doc.partner_id)
    if ('error' in resolved) return { error: resolved.error, code: 'INVALID_ACCOUNT' }

    const amount = roundCurrency(valueBaseAmount(doc, line.value_base) * Number(line.amount_multiplier ?? 1))
    if (!(amount > 0)) continue

    lines.push({
      accountId: resolved.accountId,
      debitCredit: line.debit_credit,
      amount,
      memo: renderAccountingMemo(line.memo_template || rule.description_template, doc, description)
    })
  }

  const debitTotal = roundCurrency(lines.filter((line) => line.debitCredit === 'DEBIT').reduce((sum, line) => sum + line.amount, 0))
  const creditTotal = roundCurrency(lines.filter((line) => line.debitCredit === 'CREDIT').reduce((sum, line) => sum + line.amount, 0))

  if (lines.length === 0) {
    return { error: 'A regra casou, mas nenhuma partida gerou valor maior que zero para este documento.', code: 'INVALID_AMOUNT' }
  }
  if (!lines.some((line) => line.debitCredit === 'DEBIT') || !lines.some((line) => line.debitCredit === 'CREDIT')) {
    return { error: 'A regra precisa gerar pelo menos uma partida de débito e uma de crédito com valor maior que zero.', code: 'INVALID_RULE_LINES' }
  }
  if (Math.abs(debitTotal - creditTotal) > 0.009) {
    return { error: `A regra gerou lançamento desbalanceado: débitos ${debitTotal.toFixed(2)} e créditos ${creditTotal.toFixed(2)}. Ajuste as partidas da regra.`, code: 'UNBALANCED_RULE' }
  }

  return { lines, debitTotal, creditTotal, description }
}

export async function accountFiscalDocumentAction(rawInput: unknown): Promise<ActionResult<{ journalEntryId: string; journalEntryNumber: number | null }>> {
  if (!(await canPostFiscalToAccounting())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para contabilizar documentos fiscais.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = accountFiscalDocumentSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ruleId, costCenterId } = validation.data

  try {
    const { data: doc } = await db.from('fiscal_documents').select('*').eq('id', id).eq('company_id', context.companyId).single()
    if (!doc) return { ok: false, error: 'Documento fiscal não encontrado.', code: 'NOT_FOUND' }
    if (doc.status !== 'BOOKED') {
      return { ok: false, error: `Só é possível contabilizar documentos Escriturados (status atual: ${doc.status}).`, code: 'INVALID_STATUS' }
    }
    if (doc.accounting_status === 'ACCOUNTED') {
      return { ok: false, error: 'Este documento já foi contabilizado.', code: 'ALREADY_ACCOUNTED' }
    }

    let amount = Number(doc.document_amount)
    let historico = doc.notes || `Documento fiscal ${doc.number || doc.id}`
    let mode: 'MANUAL' | 'RULE_SUGGESTED' = 'MANUAL'
    let appliedRuleId: string | null = null
    let journalLines: PreparedJournalLine[] = []

    // Se veio ruleId, a regra manda nas contas e no valor — ignora debit/creditAccountId
    // que o client possa ter mandado, re-resolvendo tudo no servidor (defesa em
    // profundidade, mesmo padrão usado na importação de XML da Etapa 32B).
    if (ruleId) {
      const { data: rule } = await db.from('fiscal_accounting_rules').select('*').eq('id', ruleId).eq('company_id', context.companyId).eq('active', true).single()
      if (!rule) return { ok: false, error: 'Regra contábil fiscal não encontrada ou inativa.', code: 'RULE_NOT_FOUND' }

      const prepared = await prepareRuleJournalLines(db, context, rule as FiscalAccountingRule, doc)
      if ('error' in prepared) return { ok: false, error: prepared.error, code: prepared.code }

      journalLines = prepared.lines
      amount = prepared.debitTotal
      historico = prepared.description
      mode = 'RULE_SUGGESTED'
      appliedRuleId = rule.id
    } else {
      const debitAccountId = validation.data.debitAccountId || null
      const creditAccountId = validation.data.creditAccountId || null

      if (!debitAccountId || !creditAccountId) {
        return { ok: false, error: 'Conta de débito/crédito não informada.', code: 'INVALID_ACCOUNT' }
      }
      if (debitAccountId === creditAccountId) {
        return { ok: false, error: 'A conta de débito não pode ser igual à conta de crédito.', code: 'INVALID_ACCOUNT' }
      }
      if (!(amount > 0)) {
        return { ok: false, error: 'O valor a contabilizar deve ser maior que zero.', code: 'INVALID_AMOUNT' }
      }

      journalLines = [
        { accountId: debitAccountId, debitCredit: 'DEBIT', amount, memo: historico },
        { accountId: creditAccountId, debitCredit: 'CREDIT', amount, memo: historico }
      ]
    }

    const accountIds = Array.from(new Set(journalLines.map((line) => line.accountId)))
    for (const accountId of accountIds) {
      const { data: acc } = await db.from('chart_accounts').select('id, company_id, is_active, is_synthetic, accepts_entries').eq('id', accountId).single()
      if (!acc || acc.company_id !== context.companyId) {
        return { ok: false, error: 'Uma das contas selecionadas não existe ou pertence a outra empresa.', code: 'INVALID_ACCOUNT' }
      }
      if (!acc.is_active || acc.is_synthetic || !acc.accepts_entries) {
        return { ok: false, error: 'As contas selecionadas devem ser analíticas, ativas e aceitar lançamentos.', code: 'INVALID_ACCOUNT' }
      }
    }

    if (costCenterId) {
      const { data: cc } = await db.from('cost_centers').select('id, company_id').eq('id', costCenterId).single()
      if (!cc || cc.company_id !== context.companyId) {
        return { ok: false, error: 'O centro de custo informado não existe ou pertence a outra empresa.', code: 'INVALID_COST_CENTER' }
      }
    }

    const competenceStart = doc.competence
    const { data: period } = await db.from('accounting_periods').select('status').eq('company_id', context.companyId).eq('competence', competenceStart).single()
    if (!period) return { ok: false, error: `Período contábil para a competência ${competenceStart} não encontrado.`, code: 'PERIOD_NOT_FOUND' }
    if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
      return { ok: false, error: `O período contábil (${competenceStart}) está fechado (${period.status}).`, code: 'PERIOD_CLOSED' }
    }

    const isInbound = doc.direction === 'IN'
    const firstDebit = journalLines.find((line) => line.debitCredit === 'DEBIT')
    const firstCredit = journalLines.find((line) => line.debitCredit === 'CREDIT')
    if (!firstDebit || !firstCredit) {
      return { ok: false, error: 'O lançamento precisa ter pelo menos uma partida de débito e uma de crédito.', code: 'INVALID_ENTRY_LINES' }
    }

    const { data: newEntry, error: insertError } = await db
      .from('journal_entries')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        entry_date: doc.operation_date || doc.issue_date,
        competence: competenceStart,
        description: `Documento fiscal ${doc.number || ''} — ${historico}`.trim(),
        document: doc.number || null,
        partner_id: doc.partner_id,
        origin: 'FISCAL_DOCUMENT',
        origin_id: doc.id,
        status: 'DRAFT'
      })
      .select('id')
      .single()

    if (insertError || !newEntry) throw insertError || new Error('Falha ao criar cabeçalho do lançamento.')

    const journalEntryId = newEntry.id

    // Compra/serviço tomado (IN): débito na conta selecionada (despesa/estoque/ativo),
    // crédito na conta selecionada (fornecedor/passivo/banco). Venda/serviço prestado
    // (OUT): débito na conta selecionada (cliente/banco), crédito na conta selecionada
    // (receita). O formulário/regra já orienta nesse sentido — aqui só aplicamos.
    const { error: linesError } = await db.from('journal_entry_lines').insert(
      journalLines.map((line) => ({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        journal_entry_id: journalEntryId,
        account_id: line.accountId,
        debit_credit: line.debitCredit,
        amount: line.amount,
        memo: line.memo,
        cost_center_id: line.debitCredit === (isInbound ? 'DEBIT' : 'CREDIT') ? costCenterId || null : null
      }))
    )

    if (linesError) {
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      throw linesError
    }

    const { data: posted, error: postError } = await db.from('journal_entries').update({ status: 'POSTED' }).eq('id', journalEntryId).select('id, number').single()
    if (postError || !posted) {
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      return { ok: false, error: postError?.message || 'O banco rejeitou a publicação do lançamento.', code: 'UNBALANCED_ENTRY' }
    }

    // Rastro imutável de como este documento virou lançamento (Etapa 32C) — nunca apagado,
    // só marcado REVERSED se estornado depois. Também é a trava real contra contabilização
    // duplicada: uq_fiscal_accounting_applications_active_per_document (erp_schema_v2_7)
    // permite só uma linha 'APPLIED' por documento, então uma segunda requisição
    // concorrente (duplo clique, lote + individual, retry) esbarra aqui com 23505 em vez
    // de gerar um segundo lançamento — a checagem de doc.accounting_status acima cobre o
    // caso comum, isto cobre a janela de corrida entre a leitura e esta escrita.
    const { error: applicationError } = await db.from('fiscal_accounting_applications').insert({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      fiscal_document_id: id,
      journal_entry_id: journalEntryId,
      rule_id: appliedRuleId,
      mode,
      debit_account_id: firstDebit.accountId,
      credit_account_id: firstCredit.accountId,
      amount,
      description: historico,
      status: 'APPLIED',
      created_by: context.profileId
    })

    if (applicationError) {
      await db.from('journal_entry_lines').delete().eq('journal_entry_id', journalEntryId)
      await db.from('journal_entries').delete().eq('id', journalEntryId)

      if (applicationError.code === '23505') {
        return { ok: false, error: 'Este documento já foi contabilizado (detectado no servidor) — atualize a página.', code: 'ALREADY_ACCOUNTED' }
      }
      throw applicationError
    }

    await db.from('fiscal_documents').update({ journal_entry_id: journalEntryId, accounting_status: 'ACCOUNTED' }).eq('id', id).eq('company_id', context.companyId)

    revalidateFiscal(id)
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')

    return { ok: true, data: { journalEntryId, journalEntryNumber: posted.number }, message: `Lançamento nº ${posted.number} gerado e documento contabilizado!` }
  } catch (error: any) {
    console.error('Erro ao contabilizar documento fiscal:', error)
    await db.from('fiscal_documents').update({ accounting_status: 'ACCOUNTING_ERROR' }).eq('id', id).eq('company_id', context.companyId)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function bulkFiscalDocumentAccountingAction(rawInput: unknown): Promise<ActionResult<BulkFiscalDocumentWorkflowResult>> {
  if (!(await canPostFiscalToAccounting())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para contabilizar documentos fiscais.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = bulkFiscalDocumentAccountingSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Seleção inválida para contabilização em lote.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const ids = Array.from(new Set(validation.data.ids))
  const failed: BulkFiscalDocumentWorkflowFailure[] = []

  try {
    const docs: { id: string; number: string | null; status: string; accounting_status: string }[] = []
    for (const chunk of chunkArray(ids, 200)) {
      const { data, error } = await db
        .from('fiscal_documents')
        .select('id, number, status, accounting_status')
        .eq('company_id', context.companyId)
        .in('id', chunk)

      if (error) throw error
      docs.push(...((data || []) as { id: string; number: string | null; status: string; accounting_status: string }[]))
    }

    const byId = new Map(docs.map((doc) => [doc.id, doc]))
    let succeeded = 0

    for (const id of ids) {
      const doc = byId.get(id)
      if (!doc) {
        failed.push({ id, label: `Documento ${id.slice(0, 8)}`, reason: 'Documento não encontrado nesta empresa.' })
        continue
      }

      if (doc.status !== 'BOOKED') {
        failed.push({ id, label: fiscalDocumentLabel(doc), reason: `Status atual ${doc.status}; só documento escriturado pode ser contabilizado.` })
        continue
      }

      if (doc.accounting_status === 'ACCOUNTED') {
        failed.push({ id, label: fiscalDocumentLabel(doc), reason: 'Documento já contabilizado.' })
        continue
      }

      const suggestion = await findFiscalAccountingRuleForDocument(id, context.companyId)
      if (!suggestion) {
        failed.push({ id, label: fiscalDocumentLabel(doc), reason: 'Nenhuma regra contábil fiscal ativa casou com este documento.' })
        continue
      }

      const result = await accountFiscalDocumentAction({ id, ruleId: suggestion.ruleId })
      if (result.ok) {
        succeeded += 1
      } else {
        failed.push({ id, label: fiscalDocumentLabel(doc), reason: result.error })
      }
    }

    revalidateFiscal()
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')

    return {
      ok: true,
      data: {
        operation: 'ACCOUNT',
        requested: ids.length,
        succeeded,
        failed
      },
      message: `${succeeded} documento(s) contabilizado(s).`
    }
  } catch (error: unknown) {
    console.error('Erro ao contabilizar documentos fiscais em lote:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

/**
 * Regera em lote a contabilização de documentos já contabilizados (estorna o lançamento
 * atual e gera outro pela regra contábil fiscal que casar) — mesma ideia de
 * bulkFiscalDocumentAccountingAction, mas para quem já tem lançamento vinculado. Só roda
 * pela regra (sem seleção manual de conta, já que é em lote); documento sem regra casando
 * é reportado como falha, igual ao lote de contabilização normal.
 */
export async function bulkRegenerateFiscalDocumentAccountingAction(rawInput: unknown): Promise<ActionResult<BulkFiscalDocumentWorkflowResult>> {
  if (!(await canPostFiscalToAccounting())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para contabilizar documentos fiscais.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = bulkFiscalDocumentAccountingSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Seleção inválida para regeração em lote.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const ids = Array.from(new Set(validation.data.ids))
  const failed: BulkFiscalDocumentWorkflowFailure[] = []

  try {
    const docs: { id: string; number: string | null; status: string; accounting_status: string }[] = []
    for (const chunk of chunkArray(ids, 200)) {
      const { data, error } = await db
        .from('fiscal_documents')
        .select('id, number, status, accounting_status')
        .eq('company_id', context.companyId)
        .in('id', chunk)

      if (error) throw error
      docs.push(...((data || []) as { id: string; number: string | null; status: string; accounting_status: string }[]))
    }

    const byId = new Map(docs.map((doc) => [doc.id, doc]))
    let succeeded = 0

    for (const id of ids) {
      const doc = byId.get(id)
      if (!doc) {
        failed.push({ id, label: `Documento ${id.slice(0, 8)}`, reason: 'Documento não encontrado nesta empresa.' })
        continue
      }

      if (doc.accounting_status !== 'ACCOUNTED') {
        failed.push({ id, label: fiscalDocumentLabel(doc), reason: 'Documento ainda não contabilizado — use "Contabilizar" em vez de "Regerar".' })
        continue
      }

      const suggestion = await findFiscalAccountingRuleForDocument(id, context.companyId)
      if (!suggestion) {
        failed.push({ id, label: fiscalDocumentLabel(doc), reason: 'Nenhuma regra contábil fiscal ativa casou com este documento.' })
        continue
      }

      const result = await regenerateFiscalDocumentAccountingAction({ id, reason: 'Regeração em lote via regra contábil fiscal.', ruleId: suggestion.ruleId })
      if (result.ok) {
        succeeded += 1
      } else {
        failed.push({ id, label: fiscalDocumentLabel(doc), reason: result.error })
      }
    }

    revalidateFiscal()
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')

    return {
      ok: true,
      data: {
        operation: 'REGENERATE',
        requested: ids.length,
        succeeded,
        failed
      },
      message: `${succeeded} documento(s) regerado(s).`
    }
  } catch (error: unknown) {
    console.error('Erro ao regerar documentos fiscais em lote:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

/**
 * Estorna a contabilização de um documento fiscal (Etapa 32B/34B). Reaproveita a stored
 * procedure transacional já existente `reverse_journal_entry` (via reverseJournalEntryAction
 * do módulo de Lançamentos) — nunca apaga o lançamento original, só cria um lançamento de
 * reversão. Marca a aplicação contábil correspondente como REVERSED e devolve o documento
 * fiscal para NOT_ACCOUNTED, preservando o histórico completo em
 * fiscal_accounting_applications.
 */
export async function reverseFiscalDocumentAccountingAction(rawInput: unknown): Promise<ActionResult<{ reversalJournalEntryId: string }>> {
  if (!(await canPostFiscalToAccounting())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para estornar contabilizações fiscais.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = reverseFiscalDocumentAccountingSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Informe o motivo do estorno.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, reason } = validation.data

  try {
    const { data: doc } = await db.from('fiscal_documents').select('id, journal_entry_id, accounting_status').eq('id', id).eq('company_id', context.companyId).single()
    if (!doc) return { ok: false, error: 'Documento fiscal não encontrado.', code: 'NOT_FOUND' }
    if (doc.accounting_status !== 'ACCOUNTED' || !doc.journal_entry_id) {
      return { ok: false, error: 'Este documento não está contabilizado — não há o que estornar.', code: 'NOT_ACCOUNTED' }
    }

    const { data: application } = await db
      .from('fiscal_accounting_applications')
      .select('id, status')
      .eq('fiscal_document_id', id)
      .eq('company_id', context.companyId)
      .eq('journal_entry_id', doc.journal_entry_id)
      .eq('status', 'APPLIED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const reversal = await reverseJournalEntryAction({ journalEntryId: doc.journal_entry_id, reason })
    if (!reversal.ok) {
      return { ok: false, error: reversal.error, code: reversal.code || 'DATABASE_ERROR' }
    }

    await db
      .from('fiscal_documents')
      .update({ accounting_status: 'NOT_ACCOUNTED', journal_entry_id: null })
      .eq('id', id)
      .eq('company_id', context.companyId)

    if (application) {
      await db
        .from('fiscal_accounting_applications')
        .update({ status: 'REVERSED', reversed_at: new Date().toISOString(), reversal_journal_entry_id: reversal.data.newEntryId })
        .eq('id', application.id)
        .eq('company_id', context.companyId)
    }

    revalidateFiscal(id)
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')

    return { ok: true, data: { reversalJournalEntryId: reversal.data.newEntryId }, message: 'Contabilização estornada — o documento voltou para pendente de contabilização.' }
  } catch (error: any) {
    console.error('Erro ao estornar contabilização do documento fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

/**
 * Regera a contabilização de um documento fiscal já contabilizado: estorna o lançamento
 * atual (reaproveitando reverseFiscalDocumentAccountingAction, que já cuida de
 * reverse_journal_entry + fiscal_accounting_applications) e, se o estorno for aceito,
 * contabiliza de novo na sequência (reaproveitando accountFiscalDocumentAction) com a
 * regra/contas informadas. Existe para cobrir o caso de "quero trocar a conta/regra usada"
 * sem deixar o usuário ter que fazer os dois passos manualmente em telas separadas — o que
 * era o único jeito antes, e levava a gente a esquecer o estorno e acabar com lançamento
 * duplicado quando tentava contabilizar de novo.
 */
export async function regenerateFiscalDocumentAccountingAction(
  rawInput: unknown
): Promise<ActionResult<{ reversalJournalEntryId: string; journalEntryId: string; journalEntryNumber: number | null }>> {
  if (!(await canPostFiscalToAccounting())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para contabilizar documentos fiscais.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = regenerateFiscalDocumentAccountingSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const { id, reason, ruleId, debitAccountId, creditAccountId, costCenterId } = validation.data

  const reversal = await reverseFiscalDocumentAccountingAction({ id, reason })
  if (!reversal.ok) {
    return { ok: false, error: reversal.error, code: reversal.code }
  }

  const reaccounted = await accountFiscalDocumentAction({ id, ruleId, debitAccountId, creditAccountId, costCenterId })
  if (!reaccounted.ok) {
    return {
      ok: false,
      error: `Estorno concluído, mas a nova contabilização falhou: ${reaccounted.error} O documento ficou pendente de contabilização — contabilize manualmente.`,
      code: reaccounted.code,
      fieldErrors: reaccounted.fieldErrors
    }
  }

  return {
    ok: true,
    data: { reversalJournalEntryId: reversal.data.reversalJournalEntryId, ...reaccounted.data },
    message: `Contabilização regerada: estorno registrado e novo lançamento nº ${reaccounted.data.journalEntryNumber} gerado.`
  }
}
