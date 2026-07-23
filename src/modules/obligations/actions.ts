'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageObligations } from '@/lib/permissions/permissions'
import {
  createObligationSchema,
  updateObligationSchema,
  obligationIdSchema,
  markObligationPaidSchema,
  generateObligationFromAssessmentSchema
} from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function revalidateObligations(id?: string) {
  revalidatePath('/obrigacoes')
  if (id) revalidatePath(`/obrigacoes/${id}`)
}

function competenceFirstDay(dateStr: string) {
  const parts = dateStr.split('-')
  return `${parts[0]}-${parts[1]}-01`
}

export async function createObligationAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageObligations())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createObligationSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const input = validation.data

  try {
    const { data, error } = await db
      .from('obligations')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        obligation_type: input.obligationType,
        competence: competenceFirstDay(input.competence),
        amount: input.amount,
        due_date: input.dueDate,
        status: 'OPEN',
        barcode: input.barcode || null,
        payment_code: input.paymentCode || null,
        document_url: input.documentUrl || null,
        notes: input.notes || null
      })
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao criar obrigação.')

    revalidateObligations()
    return { ok: true, data: { id: data.id }, message: 'Obrigação criada.' }
  } catch (error: any) {
    console.error('Erro ao criar obrigação:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateObligationAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageObligations())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateObligationSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...input } = validation.data

  try {
    const { data: existing } = await db.from('obligations').select('status').eq('id', id).eq('company_id', context.companyId).single()
    if (!existing) return { ok: false, error: 'Obrigação não encontrada.', code: 'NOT_FOUND' }
    if (existing.status === 'PAID' || existing.status === 'CANCELLED') {
      return { ok: false, error: `Obrigação ${existing.status} não pode ser editada.`, code: 'INVALID_STATUS' }
    }

    const { error } = await db
      .from('obligations')
      .update({
        obligation_type: input.obligationType,
        competence: competenceFirstDay(input.competence),
        amount: input.amount,
        due_date: input.dueDate,
        barcode: input.barcode || null,
        payment_code: input.paymentCode || null,
        document_url: input.documentUrl || null,
        notes: input.notes || null
      })
      .eq('id', id)
      .eq('company_id', context.companyId)

    if (error) throw error

    revalidateObligations(id)
    return { ok: true, data: { id }, message: 'Obrigação atualizada.' }
  } catch (error: any) {
    console.error('Erro ao atualizar obrigação:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function markObligationGeneratedAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageObligations())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = obligationIdSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id } = validation.data

  try {
    const { data: existing } = await db.from('obligations').select('status').eq('id', id).eq('company_id', context.companyId).single()
    if (!existing) return { ok: false, error: 'Obrigação não encontrada.', code: 'NOT_FOUND' }
    if (existing.status !== 'OPEN') {
      return { ok: false, error: `Só é possível marcar como gerada uma obrigação Aberta (status atual: ${existing.status}).`, code: 'INVALID_STATUS' }
    }

    await db.from('obligations').update({ status: 'GENERATED' }).eq('id', id).eq('company_id', context.companyId)

    revalidateObligations(id)
    return { ok: true, data: { id }, message: 'Guia marcada como gerada.' }
  } catch (error: any) {
    console.error('Erro ao marcar obrigação como gerada:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// Etapa 21.3: pagamento exige um lançamento contábil já existente (POSTED) vinculado —
// não gera pagamento contábil automático sem contas selecionadas, conforme pedido.
export async function markObligationPaidAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageObligations())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = markObligationPaidSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, journalEntryNumber, paidAt } = validation.data

  try {
    const { data: existing } = await db.from('obligations').select('status').eq('id', id).eq('company_id', context.companyId).single()
    if (!existing) return { ok: false, error: 'Obrigação não encontrada.', code: 'NOT_FOUND' }
    if (existing.status === 'PAID' || existing.status === 'CANCELLED') {
      return { ok: false, error: `Obrigação ${existing.status} não pode ser marcada como paga novamente.`, code: 'INVALID_STATUS' }
    }

    const { data: entry } = await db.from('journal_entries').select('id, company_id, status').eq('company_id', context.companyId).eq('number', journalEntryNumber).maybeSingle()
    if (!entry) {
      return { ok: false, error: `Lançamento contábil nº ${journalEntryNumber} não encontrado nesta empresa.`, code: 'INVALID_JOURNAL_ENTRY' }
    }
    if (entry.status !== 'POSTED') {
      return { ok: false, error: 'O lançamento de pagamento precisa estar POSTED.', code: 'INVALID_JOURNAL_ENTRY_STATUS' }
    }

    const { error } = await db
      .from('obligations')
      .update({ status: 'PAID', payment_journal_entry_id: entry.id, paid_at: paidAt })
      .eq('id', id)
      .eq('company_id', context.companyId)

    if (error) throw error

    revalidateObligations(id)
    return { ok: true, data: { id }, message: 'Obrigação marcada como paga.' }
  } catch (error: any) {
    console.error('Erro ao marcar obrigação como paga:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function markObligationDeliveredAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageObligations())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = obligationIdSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id } = validation.data

  try {
    const { data: existing } = await db.from('obligations').select('status').eq('id', id).eq('company_id', context.companyId).single()
    if (!existing) return { ok: false, error: 'Obrigação não encontrada.', code: 'NOT_FOUND' }
    if (existing.status === 'CANCELLED') {
      return { ok: false, error: 'Obrigação cancelada não pode ser marcada como entregue.', code: 'INVALID_STATUS' }
    }

    await db.from('obligations').update({ status: 'DELIVERED', delivered_at: new Date().toISOString() }).eq('id', id).eq('company_id', context.companyId)

    revalidateObligations(id)
    return { ok: true, data: { id }, message: 'Obrigação marcada como entregue.' }
  } catch (error: any) {
    console.error('Erro ao marcar obrigação como entregue:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function cancelObligationAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageObligations())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = obligationIdSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id } = validation.data

  try {
    const { data: existing } = await db.from('obligations').select('status, payment_journal_entry_id').eq('id', id).eq('company_id', context.companyId).single()
    if (!existing) return { ok: false, error: 'Obrigação não encontrada.', code: 'NOT_FOUND' }
    if (existing.payment_journal_entry_id) {
      return { ok: false, error: 'Obrigação já paga não pode ser cancelada — estorne o pagamento primeiro.', code: 'ALREADY_PAID' }
    }

    await db.from('obligations').update({ status: 'CANCELLED' }).eq('id', id).eq('company_id', context.companyId)

    revalidateObligations(id)
    return { ok: true, data: { id }, message: 'Obrigação cancelada.' }
  } catch (error: any) {
    console.error('Erro ao cancelar obrigação:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// ETAPA 21: APURAÇÃO -> OBRIGAÇÃO
// =====================================================================================

export async function generateObligationFromAssessmentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageObligations())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = generateObligationFromAssessmentSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { taxAssessmentId, obligationType, dueDate } = validation.data

  try {
    const { data: assessment } = await db.from('tax_assessments').select('*').eq('id', taxAssessmentId).eq('company_id', context.companyId).single()
    if (!assessment) return { ok: false, error: 'Apuração fiscal não encontrada.', code: 'NOT_FOUND' }
    if (assessment.status !== 'CLOSED') {
      // Gerar a partir de uma apuração ainda CALCULATED permitiria recalculá-la depois
      // (calculateTaxAssessmentAction aceita DRAFT/CALCULATED) e deixar o valor da
      // obrigação já gerada dessincronizado do payable_amount atual, sem nenhum mecanismo
      // de resync. Fechar primeiro (CLOSED é terminal para recálculo) elimina a janela.
      return { ok: false, error: `Só é possível gerar obrigação a partir de apuração Fechada (status atual: ${assessment.status}).`, code: 'INVALID_STATUS' }
    }
    if (assessment.obligation_id) {
      return { ok: false, error: 'Esta apuração já tem uma obrigação gerada.', code: 'ALREADY_GENERATED' }
    }
    // Etapa 24: apuração fechada com saldo credor (payable_amount=0, next_balance_amount>0)
    // não gera guia de pagamento — nada a cobrar. Preferido bloquear a criar uma obrigação
    // zerada sem sentido de cobrança.
    if (!(Number(assessment.payable_amount) > 0)) {
      return { ok: false, error: 'Apuração sem valor a recolher.', code: 'NOTHING_TO_ACCOUNT' }
    }

    const { data: obligation, error } = await db
      .from('obligations')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        obligation_type: obligationType,
        competence: assessment.competence,
        amount: assessment.payable_amount,
        due_date: dueDate,
        status: 'GENERATED',
        origin_assessment_id: taxAssessmentId,
        origin_assessment_table: 'tax_assessments'
      })
      .select('id')
      .single()

    if (error || !obligation) throw error || new Error('Falha ao gerar obrigação.')

    await db.from('tax_assessments').update({ obligation_id: obligation.id }).eq('id', taxAssessmentId).eq('company_id', context.companyId)

    revalidateObligations()
    revalidatePath('/fiscal/apuracoes')
    revalidatePath(`/fiscal/apuracoes/${taxAssessmentId}`)

    return { ok: true, data: { id: obligation.id }, message: 'Guia/obrigação gerada a partir da apuração.' }
  } catch (error: any) {
    console.error('Erro ao gerar obrigação a partir de apuração:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
