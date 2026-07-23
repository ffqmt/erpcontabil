'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { closeAccountingPeriodSchema, reopenAccountingPeriodSchema } from './validations'
import { getUserPermissions, canCloseAccountingPeriod, canReopenAccountingPeriod } from '@/lib/permissions/permissions'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

/**
 * Server Action para fechar uma competência contábil ativa.
 */
export async function closeAccountingPeriodAction(
  rawInput: unknown
): Promise<ActionResult<{ id: string }>> {
  const context = await getCurrentContext()
  const hasPerm = await canCloseAccountingPeriod()

  // 1. Validar permissão
  if (!hasPerm) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para fechar períodos contábeis.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  // 2. Validar input Zod
  const validation = closeAccountingPeriodSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'ID de período inválido.', code: 'VALIDATION_ERROR' }
  }

  const { periodId } = validation.data

  const db = await getClient()

  try {
    // 3. Buscar o período contábil
    const { data: period, error: findError } = await db
      .from('accounting_periods')
      .select('*')
      .eq('id', periodId)
      .eq('company_id', context.companyId)
      .single()

    if (findError || !period) {
      return { ok: false, error: 'Período contábil não encontrado.', code: 'PERIOD_NOT_FOUND' }
    }

    if (period.status === 'CLOSED') {
      return { ok: false, error: 'Este período contábil já se encontra fechado.', code: 'INVALID_PERIOD_STATUS' }
    }

    // 4. Bloquear fechamento se houver lançamentos DRAFT na competência
    const { count, error: draftError } = await db
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', context.companyId)
      .eq('competence', period.competence)
      .eq('status', 'DRAFT')

    if (draftError) throw draftError

    if (count && count > 0) {
      return {
        ok: false,
        error: `Não é possível fechar o período de ${period.competence} porque existem ${count} lançamentos contábeis em Rascunho. Publique ou exclua-os primeiro.`,
        code: 'PERIOD_HAS_DRAFTS'
      }
    }

    // 5. Atualizar o status do período no banco
    const { error: updateError } = await db
      .from('accounting_periods')
      .update({
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
        // closed_by referencia auth.users(id), não profiles(id) — usar context.user.id
        // (Etapa 30A: bug pré-existente encontrado em teste real; context.profileId aqui
        // violava a FK accounting_periods_closed_by_fkey para qualquer usuário real).
        closed_by: context.user.id
      })
      .eq('id', periodId)

    if (updateError) {
      // Trata erro de trigger (competência anterior aberta)
      if (updateError.code === '23514' || updateError.message?.includes('anterior ainda não está fechada')) {
        return {
          ok: false,
          error: 'Não é possível fechar este período porque o período contábil anterior ainda está aberto. Feche os meses em sequência direta.',
          code: 'PREVIOUS_PERIOD_OPEN'
        }
      }
      throw updateError
    }

    // 6. Revalidar caches das páginas contábeis do ERP
    revalidatePath('/contabilidade/periodos')
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')
    revalidatePath('/contabilidade/dre')
    revalidatePath('/contabilidade/balanco')

    return {
      ok: true,
      data: { id: periodId },
      message: 'Período contábil fechado com sucesso!'
    }
  } catch (error: any) {
    console.error('Erro ao fechar período contábil:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

/**
 * Server Action para reabrir uma competência contábil fechada.
 */
export async function reopenAccountingPeriodAction(
  rawInput: unknown
): Promise<ActionResult<{ id: string }>> {
  const context = await getCurrentContext()
  const hasPerm = await canReopenAccountingPeriod()

  // 1. Validar permissão
  if (!hasPerm) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para reabrir períodos contábeis.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  // 2. Validar input Zod (inclui motivo obrigatório da reabertura — Etapa 30A)
  const validation = reopenAccountingPeriodSchema.safeParse(rawInput)
  if (!validation.success) {
    return {
      ok: false,
      error: 'Dados inválidos: informe um motivo com pelo menos 10 caracteres.',
      code: 'VALIDATION_ERROR',
      fieldErrors: validation.error.flatten().fieldErrors
    }
  }

  const { periodId, reason } = validation.data

  const db = await getClient()

  try {
    // 3. Buscar o período contábil
    const { data: period, error: findError } = await db
      .from('accounting_periods')
      .select('*')
      .eq('id', periodId)
      .eq('company_id', context.companyId)
      .single()

    if (findError || !period) {
      return { ok: false, error: 'Período contábil não encontrado.', code: 'PERIOD_NOT_FOUND' }
    }

    if (period.status !== 'CLOSED') {
      return { ok: false, error: 'Este período contábil não está fechado.', code: 'INVALID_PERIOD_STATUS' }
    }

    // 4. Atualizar o status para REOPENED no banco, com motivo obrigatório na trilha de
    // auditoria (Etapa 30A — reopen_reason em db/migrations/erp_schema_v1_6_*.sql).
    const { error: updateError } = await db
      .from('accounting_periods')
      .update({
        status: 'REOPENED',
        reopened_at: new Date().toISOString(),
        // reopened_by referencia auth.users(id), não profiles(id) — mesmo bug de closed_by
        // corrigido acima (Etapa 30A).
        reopened_by: context.user.id,
        reopen_reason: reason
      })
      .eq('id', periodId)

    if (updateError) {
      // Trata erro de trigger (competência posterior fechada)
      if (updateError.code === '23514' || updateError.message?.includes('seguinte já está fechada')) {
        return {
          ok: false,
          error: 'Não é possível reabrir este período porque a competência contábil seguinte já se encontra fechada. Reabra as competências posteriores primeiro.',
          code: 'NEXT_PERIOD_CLOSED'
        }
      }
      throw updateError
    }

    // 5. Revalidar caches das páginas
    revalidatePath('/contabilidade/periodos')
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')
    revalidatePath('/contabilidade/dre')
    revalidatePath('/contabilidade/balanco')

    return {
      ok: true,
      data: { id: periodId },
      message: 'Período contábil reaberto com sucesso!'
    }
  } catch (error: any) {
    console.error('Erro ao reabrir período contábil:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
