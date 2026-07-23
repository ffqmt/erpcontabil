'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { canManageTaxAssessments } from '@/lib/permissions/permissions'
import { getClient } from '@/lib/supabase/server'
import { updateCompanyTaxAssessmentSettingsSchema } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

export async function updateCompanyTaxAssessmentSettingsAction(rawInput: unknown): Promise<ActionResult<{ count: number }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateCompanyTaxAssessmentSettingsSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const payload = validation.data.settings.map((setting) => ({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      tax_type: setting.taxType,
      enabled: setting.enabled,
      account_assessment: setting.accountAssessment,
      calculation_mode: setting.calculationMode
    }))

    const { error } = await db
      .from('company_tax_assessment_settings')
      .upsert(payload, { onConflict: 'company_id,tax_type' })

    if (error) throw error

    revalidatePath('/fiscal/configuracoes-tributarias')
    revalidatePath('/fiscal/apuracoes/nova')

    return { ok: true, data: { count: payload.length }, message: 'Configuração de apuração tributária salva.' }
  } catch (error: unknown) {
    console.error('Erro ao salvar configuração de apuração tributária:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
