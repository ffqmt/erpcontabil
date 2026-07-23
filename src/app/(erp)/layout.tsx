import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell/app-shell'

interface LayoutProps {
  children: React.ReactNode
}

const PERF_WARNING_MS = 300

function warnLayoutPerf(details: Record<string, unknown>) {
  if (
    process.env.NODE_ENV !== 'production' &&
    typeof details.totalMs === 'number' &&
    details.totalMs >= PERF_WARNING_MS
  ) {
    console.warn('[perf-debug] erp-layout', details)
  }
}

export default async function ErpLayout({ children }: LayoutProps) {
  const layoutStartedAt = Date.now()

  // Etapa 29B: getCurrentContext() agora resolve identidade/empresa/competência a partir
  // da sessão Supabase Auth real (ver src/lib/context/current-context.ts) — este layout
  // mantém apenas os dados extras do shell (workspace, empresas e período) fora do contexto
  // leve para não pesar Server Actions e páginas que só precisam do tenant ativo.
  const contextStartedAt = Date.now()
  const context = await getCurrentContext()
  const contextMs = Date.now() - contextStartedAt

  let workspaceName = 'Escritório Demo'
  let periodStatus = 'OPEN'
  let companies = [{ id: context.activeCompany.id, legal_name: context.activeCompany.legal_name }]

  const shellStartedAt = Date.now()
  try {
    const supabase = await createClient()
    const [workspaceResult, companiesResult, periodResult] = await Promise.all([
      supabase.from('workspaces').select('name').eq('id', context.workspaceId).maybeSingle(),
      supabase
        .from('companies')
        .select('id, legal_name, workspace_id')
        .eq('active', true)
        .order('legal_name', { ascending: true }),
      supabase
        .from('accounting_periods')
        .select('status')
        .eq('company_id', context.companyId)
        .eq('competence', context.competence)
        .maybeSingle()
    ])

    if (workspaceResult.error) {
      console.warn('Falha ao buscar nome do workspace — usando fallback local.', workspaceResult.error)
    } else if (workspaceResult.data?.name) {
      workspaceName = workspaceResult.data.name
    }

    if (companiesResult.error) {
      console.warn('Falha ao carregar empresas permitidas — usando empresa ativa.', companiesResult.error)
    } else if (companiesResult.data?.length) {
      companies = companiesResult.data.map((company) => ({
        id: company.id,
        legal_name: company.legal_name
      }))
    }

    if (periodResult.error) {
      console.warn('Falha ao carregar status do período — usando OPEN como fallback.', periodResult.error)
    } else if (periodResult.data?.status) {
      periodStatus = periodResult.data.status
    }
  } catch (error) {
    console.warn('Falha ao carregar dados do shell — usando fallbacks locais.', error)
  }
  const shellMs = Date.now() - shellStartedAt
  const totalMs = Date.now() - layoutStartedAt

  warnLayoutPerf({
    contextMs,
    shellMs,
    totalMs,
    companyId: context.companyId,
    companiesCount: companies.length
  })

  // Regra D da Etapa 29B: se o profile não tiver nome preenchido, mostra o e-mail real do
  // usuário autenticado — nunca um nome fictício ("Desenvolvedor Demo") de outro usuário.
  const userName = context.profile.name || context.user.email
  const userEmail = context.user.email

  return (
    <AppShell
      workspaceName={workspaceName}
      companyId={context.companyId}
      legalName={context.activeCompany.legal_name}
      competence={context.competence}
      periodStatus={periodStatus}
      userName={userName}
      userEmail={userEmail}
      companies={companies}
    >
      {children}
    </AppShell>
  )
}
