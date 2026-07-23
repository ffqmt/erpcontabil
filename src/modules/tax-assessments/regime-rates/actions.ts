'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageTaxAssessments } from '@/lib/permissions/permissions'
import {
  createTaxRegimeRateSchema,
  updateTaxRegimeRateSchema,
  toggleTaxRegimeRateActiveSchema,
  deleteTaxRegimeRateSchema
} from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function toRow(input: any) {
  return {
    tax_regime: input.taxRegime,
    tax_type: input.taxType,
    fiscal_operation_nature_id: input.fiscalOperationNatureId || null,
    presumption_rate: input.presumptionRate ?? null,
    tax_rate: input.taxRate,
    additional_rate: input.additionalRate ?? null,
    additional_threshold_monthly: input.additionalThresholdMonthly ?? null,
    valid_from: input.validFrom,
    valid_until: input.validUntil || null
  }
}

export async function createTaxRegimeRateAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = createTaxRegimeRateSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const { data, error } = await db
      .from('tax_regime_rates')
      .insert({ workspace_id: context.workspaceId, company_id: context.companyId, active: true, ...toRow(validation.data) })
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '42501') return { ok: false, error: 'Sua função não permite administrar alíquotas tributárias — apenas Contador/OWNER/ADMIN.', code: 'INSUFFICIENT_PERMISSIONS' }
      throw error || new Error('Falha ao criar configuração de alíquota.')
    }

    revalidatePath('/fiscal/configuracoes-tributarias')
    return { ok: true, data: { id: data.id }, message: 'Configuração de alíquota criada.' }
  } catch (error: any) {
    console.error('Erro ao criar configuração de alíquota:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateTaxRegimeRateAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = updateTaxRegimeRateSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...fields } = validation.data

  try {
    const { error } = await db.from('tax_regime_rates').update(toRow(fields)).eq('id', id).eq('company_id', context.companyId)
    if (error) throw error

    revalidatePath('/fiscal/configuracoes-tributarias')
    return { ok: true, data: { id }, message: 'Configuração de alíquota atualizada.' }
  } catch (error: any) {
    console.error('Erro ao atualizar configuração de alíquota:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function toggleTaxRegimeRateActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; active: boolean }>> {
  if (!(await canManageTaxAssessments())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = toggleTaxRegimeRateActiveSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, active } = validation.data

  try {
    const { data, error } = await db.from('tax_regime_rates').update({ active }).eq('id', id).eq('company_id', context.companyId).select('id, active').single()
    if (error || !data) throw error || new Error('Falha ao alterar status.')

    revalidatePath('/fiscal/configuracoes-tributarias')
    return { ok: true, data: { id: data.id, active: data.active }, message: data.active ? 'Reativada.' : 'Desativada.' }
  } catch (error: any) {
    console.error('Erro ao alterar status da alíquota:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function deleteTaxRegimeRateAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = deleteTaxRegimeRateSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const { error } = await db.from('tax_regime_rates').delete().eq('id', validation.data.id).eq('company_id', context.companyId)
    if (error) throw error

    revalidatePath('/fiscal/configuracoes-tributarias')
    return { ok: true, data: { id: validation.data.id }, message: 'Configuração excluída.' }
  } catch (error: any) {
    console.error('Erro ao excluir configuração de alíquota:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
