import { cache } from 'react'
import { cookies } from 'next/headers'
import { createServerUserClient } from '@/lib/supabase/server'

export interface AllowedCompany {
  id: string
  legal_name: string
  workspace_id: string
}

export interface CurrentContext {
  // Campos legados — mantidos com os mesmos nomes/tipos para não quebrar nenhum dos
  // ~40 arquivos existentes que já fazem `const context = await getCurrentContext()` e
  // leem `context.workspaceId`/`context.companyId`/`context.profileId`/`context.competence`.
  workspaceId: string
  companyId: string
  profileId: string
  competence: string // ISO Date normalizado para o primeiro dia do mês (YYYY-MM-01)

  // Campos novos da Etapa 29B (achado P1 #2 da auditoria E2E — identidade da sessão
  // desacoplada do usuário real).
  user: { id: string; email: string }
  profile: { id: string; name: string | null; email: string }
  activeCompany: AllowedCompany
  allowedCompanies: AllowedCompany[]
  activeAccountingPeriod: { status: string } | null
}

function normalizeCompetence(raw: string | undefined | null): string {
  const fallback = raw || new Date().toISOString().substring(0, 10)
  const date = new Date(fallback + (fallback.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(date.getTime())) return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

const PERF_WARNING_MS = 300

function warnContextPerf(details: Record<string, unknown>) {
  if (
    process.env.NODE_ENV !== 'production' &&
    typeof details.totalMs === 'number' &&
    details.totalMs >= PERF_WARNING_MS
  ) {
    console.warn('[perf-debug] getCurrentContext', details)
  }
}

// Etapa 0: fallback explícito só para desenvolvimento local sem sessão (ex.: rodar um
// script isolado que importe módulos deste projeto fora do fluxo HTTP normal). NUNCA
// disparado silenciosamente — exige NODE_ENV != production E a flag de opt-in explícita
// DEV_ALLOW_UNAUTHENTICATED_CONTEXT=true (ausente por padrão em .env.local). Isso resolve
// o achado F da Etapa 29B: antes, a ausência de sessão SEMPRE caía nesse fallback sem
// nenhum aviso, mascarando qualquer bug real de autenticação/contexto — inclusive quando
// havia sessão real mas algo no lookup de profile/empresa falhava silenciosamente.
function getDevFallbackContext(): CurrentContext {
  const workspaceId = process.env.DEV_WORKSPACE_ID
  const companyId = process.env.DEV_COMPANY_ID
  const profileId = process.env.DEV_PROFILE_ID
  if (!workspaceId || !companyId || !profileId) {
    throw new Error(
      'Sessão de autenticação ausente e fallback DEV_* incompleto. Configure DEV_WORKSPACE_ID, DEV_COMPANY_ID e DEV_PROFILE_ID no .env.local, ou faça login em /login.'
    )
  }
  const competence = normalizeCompetence(process.env.DEV_COMPETENCE)
  const company: AllowedCompany = { id: companyId, legal_name: 'Empresa Demo (fallback DEV_*)', workspace_id: workspaceId }
  return {
    workspaceId,
    companyId,
    profileId,
    competence,
    user: { id: profileId, email: 'dev-fallback@local' },
    profile: { id: profileId, name: 'Fallback DEV_* (sem sessão)', email: 'dev-fallback@local' },
    activeCompany: company,
    allowedCompanies: [company],
    activeAccountingPeriod: null
  }
}

/**
 * Obtém o contexto operacional do usuário autenticado (Etapa 29B — corrige o achado P1 #2
 * da auditoria E2E: antes, este contexto nunca lia a sessão real do Supabase Auth, só
 * cookies arbitrários com fallback para variáveis DEV_* — funcionava por coincidência dos
 * dados de teste, não por garantia arquitetural).
 *
 * Mantido deliberadamente leve: esta função é chamada por quase todas as páginas e Server
 * Actions. Ela resolve sessão, perfil, empresa ativa e competência. Dados de shell
 * (lista completa de empresas e status informativo do período) ficam no layout autenticado,
 * onde são realmente usados.
 *
 * Envolto em `cache()` do React para deduplicar dentro do mesmo ciclo de renderização —
 * evita repetir getUser()+profiles+empresa ativa toda vez que um Server Component/Action
 * chama getCurrentContext() na mesma requisição (ex.: layout + page).
 */
export const getCurrentContext = cache(async function getCurrentContext(): Promise<CurrentContext> {
  const totalStartedAt = Date.now()
  const supabase = await createServerUserClient()

  const authStartedAt = Date.now()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  const authMs = Date.now() - authStartedAt

  if (userError || !user || !user.email) {
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_ALLOW_UNAUTHENTICATED_CONTEXT === 'true') {
      return getDevFallbackContext()
    }
    throw new Error('Sessão de autenticação ausente ou expirada. Faça login novamente.')
  }

  const profileStartedAt = Date.now()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  const profileMs = Date.now() - profileStartedAt

  if (profileError || !profile) {
    throw new Error(
      `O usuário autenticado (${user.email}) não possui um perfil de aplicação vinculado (profiles.auth_user_id). Contate o administrador do escritório.`
    )
  }

  const cookiesStartedAt = Date.now()
  const cookieStore = await cookies()
  const requestedCompanyId = cookieStore.get('current_company_id')?.value
  const competence = normalizeCompetence(cookieStore.get('current_competence')?.value)
  const cookiesMs = Date.now() - cookiesStartedAt

  const companyStartedAt = Date.now()
  let activeCompany: AllowedCompany | null = null
  let companyLookup: 'cookie' | 'first' | 'fallback-first' = requestedCompanyId ? 'cookie' : 'first'

  if (requestedCompanyId) {
    const { data: cookieCompany, error: cookieCompanyError } = await supabase
      .from('companies')
      .select('id, legal_name, workspace_id')
      .eq('id', requestedCompanyId)
      .eq('active', true)
      .maybeSingle()

    if (cookieCompanyError) {
      throw new Error(`Falha ao validar a empresa ativa para ${user.email}: ${cookieCompanyError.message}`)
    }

    activeCompany = cookieCompany
  }

  if (!activeCompany) {
    companyLookup = requestedCompanyId ? 'fallback-first' : 'first'
    const { data: firstCompany, error: firstCompanyError } = await supabase
      .from('companies')
      .select('id, legal_name, workspace_id')
      .eq('active', true)
      .order('legal_name', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (firstCompanyError) {
      throw new Error(`Falha ao carregar a empresa ativa para ${user.email}: ${firstCompanyError.message}`)
    }

    activeCompany = firstCompany
  }

  const companyMs = Date.now() - companyStartedAt

  if (!activeCompany) {
    throw new Error(
      `O usuário ${user.email} está autenticado, mas não tem acesso a nenhuma empresa. Contate o administrador do escritório para vincular seu perfil (workspace_users/company_users).`
    )
  }

  const totalMs = Date.now() - totalStartedAt
  warnContextPerf({
    authMs,
    profileMs,
    cookiesMs,
    companyMs,
    totalMs,
    companyLookup,
    companyId: activeCompany.id
  })

  return {
    workspaceId: activeCompany.workspace_id,
    companyId: activeCompany.id,
    profileId: profile.id,
    competence,
    user: { id: user.id, email: user.email },
    profile,
    activeCompany,
    allowedCompanies: [activeCompany],
    activeAccountingPeriod: null
  }
})
