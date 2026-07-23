'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getClient } from '@/lib/supabase/server'
import { getCurrentContext } from './current-context'
import { getCurrentAccountingPeriod } from '@/modules/accounting/periods/queries'

export type ContextActionResult = { ok: true } | { ok: false; error: string }

const COOKIE_OPTIONS = { path: '/', maxAge: 60 * 60 * 24 * 90, sameSite: 'lax' as const }

// Os TODOs originais de company-switcher.tsx/period-selector.tsx nunca foram implementados
// — nenhuma rota do app jamais escrevia current_company_id/current_competence, então a
// troca de empresa/competência era só decorativa (getCurrentContext() sempre caía no
// fallback DEV_*). Esta action valida a empresa contra a RLS do usuário autenticado
// (nunca confia cegamente no id vindo do client) antes de gravar o cookie.
export async function setActiveCompanyAction(companyId: string): Promise<ContextActionResult> {
  if (!companyId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)) {
    return { ok: false, error: 'Empresa inválida.' }
  }

  try {
    const db = await getClient()
    const { data: company, error } = await db.from('companies').select('id, workspace_id').eq('id', companyId).single()

    if (error || !company) {
      return { ok: false, error: 'Empresa não encontrada ou você não tem acesso a ela (RLS).' }
    }

    const cookieStore = await cookies()
    cookieStore.set('current_company_id', company.id, COOKIE_OPTIONS)
    // A empresa pertence a um workspace específico — mantém o cookie de workspace
    // sincronizado para não deixar company/workspace de contextos diferentes.
    cookieStore.set('current_workspace_id', company.workspace_id, COOKIE_OPTIONS)

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error.message || 'Falha ao trocar de empresa.' }
  }
}

export async function setActiveCompetenceAction(competence: string): Promise<ContextActionResult> {
  if (!competence || !/^\d{4}-\d{2}(-\d{2})?$/.test(competence)) {
    return { ok: false, error: 'Competência inválida.' }
  }

  const normalized = `${competence.substring(0, 7)}-01`

  try {
    // Confirma que existe (ou autocria) um accounting_periods para a empresa ativa antes de
    // trocar — reaproveita getCurrentAccountingPeriod (mesma rotina usada pelo restante do
    // módulo contábil, com fallback documentado a Admin Client só se o INSERT via User
    // Client falhar — ver achado da Etapa 26).
    const context = await getCurrentContext()
    await getCurrentAccountingPeriod(context.companyId, normalized, context.workspaceId)

    const cookieStore = await cookies()
    cookieStore.set('current_competence', normalized, COOKIE_OPTIONS)

    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error.message || 'Falha ao trocar de competência.' }
  }
}
