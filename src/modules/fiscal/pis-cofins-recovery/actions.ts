'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageFiscal } from '@/lib/permissions/permissions'
import { upsertPisCofinsRecoverySettingsSchema } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

/**
 * Etapa 35A: única forma de habilitar o recálculo de PIS/COFINS recuperável na importação
 * de XML — antes disso existir, o valor era sempre calculado com alíquota fixa no código
 * (1,65%/7,60%) para qualquer empresa. Agora exige configuração explícita, e mesmo assim só
 * tem efeito quando a empresa está no regime Lucro Real (checado em xml-import/actions.ts).
 */
export async function upsertPisCofinsRecoverySettingsAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = upsertPisCofinsRecoverySettingsSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { enabled, pisRate, cofinsRate, notes } = validation.data

  try {
    const { data, error } = await db
      .from('pis_cofins_recovery_settings')
      .upsert(
        {
          workspace_id: context.workspaceId,
          company_id: context.companyId,
          enabled,
          pis_rate: pisRate,
          cofins_rate: cofinsRate,
          notes: notes || null
        },
        { onConflict: 'company_id' }
      )
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao salvar configuração de crédito de PIS/COFINS.')

    revalidatePath('/fiscal/configuracoes-tributarias')
    return { ok: true, data: { id: data.id }, message: 'Configuração de crédito de PIS/COFINS salva.' }
  } catch (error: any) {
    console.error('Erro ao salvar configuração de PIS/COFINS recuperável:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
