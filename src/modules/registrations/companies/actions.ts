'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageCompanies } from '@/lib/permissions/permissions'
import { createCompanySchema, updateCompanySchema, toggleCompanyActiveSchema } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function toRow(input: {
  legalName: string
  tradeName?: string
  cnpj: string
  stateRegistration?: string
  municipalRegistration?: string
  nire?: string
  incorporationDate?: string
  taxRegime: string
  companyProfile: string
  city?: string
  state?: string
  responsibleName?: string
  responsibleCpf?: string
  responsibleRole?: string
  responsibleCrc?: string
  mainCnae?: string
  secondaryCnaes?: string[]
}) {
  return {
    legal_name: input.legalName,
    trade_name: input.tradeName || null,
    cnpj: input.cnpj,
    state_registration: input.stateRegistration || null,
    municipal_registration: input.municipalRegistration || null,
    nire: input.nire || null,
    incorporation_date: input.incorporationDate || null,
    tax_regime: input.taxRegime,
    company_profile: input.companyProfile,
    city: input.city || null,
    state: input.state ? input.state.toUpperCase() : null,
    responsible_name: input.responsibleName || null,
    responsible_cpf: input.responsibleCpf || null,
    responsible_role: input.responsibleRole || null,
    responsible_crc: input.responsibleCrc || null,
    main_cnae: input.mainCnae || null,
    secondary_cnaes: input.secondaryCnaes || []
  }
}

/**
 * Cria uma nova empresa no workspace ativo e vincula automaticamente quem criou como
 * ACCOUNTANT em company_users (Etapa 30A — apontamento 1: "onde criar empresas?"). RLS
 * (companies_insert/company_users_insert) exige can_admin_workspace — só OWNER/ADMIN do
 * escritório podem criar empresa, então o vínculo automático é sempre seguro (o próprio
 * criador já tem o nível de acesso necessário para se auto-vincular).
 */
/**
 * Helpers para inicialização operacional de novas empresas
 */
async function initializeDefaultChartAccounts(db: any, newCompanyId: string, workspaceId: string) {
  // 1. Obter todas as contas da empresa modelo
  const { data: modelAccounts, error: fetchError } = await db
    .from('chart_accounts')
    .select('*')
    .eq('company_id', '99999999-9999-9999-9999-999999999999')
    .eq('is_active', true)
  
  if (fetchError || !modelAccounts || modelAccounts.length === 0) {
    console.warn('Aviso: plano de contas modelo de referência não encontrado ou vazio. Pulando cópia:', fetchError)
    return
  }

  // 2. Mapear IDs
  const idMap = new Map<string, string>()
  for (const acc of modelAccounts) {
    idMap.set(acc.id, crypto.randomUUID())
  }

  // 3. Preparar as linhas
  const newAccounts = modelAccounts.map((acc: any) => ({
    id: idMap.get(acc.id),
    workspace_id: workspaceId,
    company_id: newCompanyId,
    parent_id: acc.parent_id ? idMap.get(acc.parent_id) : null,
    code: acc.code,
    name: acc.name,
    account_type: acc.account_type,
    normal_balance: acc.normal_balance,
    is_synthetic: acc.is_synthetic,
    accepts_entries: acc.accepts_entries,
    non_entry_reason: acc.non_entry_reason,
    is_active: true,
    dre_group: acc.dre_group,
    bp_group: acc.bp_group,
    order_dre: acc.order_dre,
    order_bp: acc.order_bp
  }))

  // 4. Ordenar por nível (número de pontos no código) para manter integridade da FK parent_id
  newAccounts.sort((a: any, b: any) => {
    const dotsA = (a.code.match(/\./g) || []).length
    const dotsB = (b.code.match(/\./g) || []).length
    return dotsA - dotsB
  })

  // 5. Inserir lote
  const { error: insertError } = await db.from('chart_accounts').insert(newAccounts)
  if (insertError) {
    console.error('Erro ao inicializar plano de contas:', insertError)
    throw insertError
  }
}

async function initializeInitialPeriod(db: any, newCompanyId: string, workspaceId: string, competenceStr?: string) {
  let competenceDate: string
  if (competenceStr && /^\d{4}-\d{2}-\d{2}$/.test(competenceStr)) {
    competenceDate = competenceStr
  } else {
    const now = new Date()
    competenceDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }

  const parts = competenceDate.split('-')
  const year = parseInt(parts[0])
  const month = parseInt(parts[1])
  
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { error: periodError } = await db.from('accounting_periods').insert({
    workspace_id: workspaceId,
    company_id: newCompanyId,
    competence: competenceDate,
    start_date: competenceDate,
    end_date: endDate,
    status: 'OPEN'
  })

  if (periodError) {
    console.error('Erro ao inicializar período contábil:', periodError)
    throw periodError
  }
}

export async function createCompanyAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageCompanies())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar empresas.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createCompanySchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { createDefaultChartAccounts, createInitialPeriod, initialPeriodCompetence, ...companyData } = validation.data

  try {
    const { data: company, error: companyError } = await db
      .from('companies')
      .insert({
        workspace_id: context.workspaceId,
        active: true,
        ...toRow(companyData)
      })
      .select('id')
      .single()

    if (companyError || !company) {
      if (companyError?.code === '23505') {
        return { ok: false, error: 'Já existe uma empresa com este CNPJ neste escritório.', code: 'DUPLICATE_CNPJ' }
      }
      if (companyError?.code === '42501') {
        return { ok: false, error: 'Sua função não permite criar empresas — apenas OWNER/ADMIN do escritório podem. Peça a um administrador.', code: 'INSUFFICIENT_PERMISSIONS' }
      }
      throw companyError || new Error('Falha ao criar empresa.')
    }

    // Vínculo automático do criador
    const { error: linkError } = await db.from('company_users').insert({
      company_id: company.id,
      profile_id: context.profileId,
      role: 'ACCOUNTANT'
    })
    if (linkError && linkError.code !== '23505') {
      console.error('Aviso: falha ao autovincular criador da empresa em company_users:', linkError)
    }

    // Inicialização operacional (Plano de Contas)
    if (createDefaultChartAccounts) {
      await initializeDefaultChartAccounts(db, company.id, context.workspaceId)
    }

    // Inicialização operacional (Período Contábil)
    if (createInitialPeriod) {
      await initializeInitialPeriod(db, company.id, context.workspaceId, initialPeriodCompetence)
    }

    revalidatePath('/cadastros/empresas')
    revalidatePath('/', 'layout')

    return { ok: true, data: { id: company.id }, message: 'Empresa criada com sucesso e inicializada operacionalmente!' }
  } catch (error: any) {
    console.error('Erro ao criar empresa:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateCompanyAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageCompanies())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar empresas.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateCompanySchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...fields } = validation.data

  try {
    const { data, error } = await db
      .from('companies')
      .update(toRow(fields))
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return { ok: false, error: 'Já existe uma empresa com este CNPJ neste escritório.', code: 'DUPLICATE_CNPJ' }
      }
      if (error?.code === '42501') {
        return { ok: false, error: 'Sua função não permite editar esta empresa.', code: 'INSUFFICIENT_PERMISSIONS' }
      }
      throw error || new Error('Falha ao atualizar empresa.')
    }

    revalidatePath('/cadastros/empresas')
    revalidatePath('/', 'layout')

    return { ok: true, data: { id: data.id }, message: 'Empresa atualizada com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao atualizar empresa:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function toggleCompanyActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; active: boolean }>> {
  if (!(await canManageCompanies())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para gerenciar empresas.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = toggleCompanyActiveSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, active } = validation.data

  try {
    // Se for inativação, precisamos validar o guard multiempresa
    if (!active) {
      // 1. Obter todas as empresas ativas acessíveis do workspace do usuário
      const { data: activeCompanies, error: listError } = await db
        .from('companies')
        .select('id')
        .eq('workspace_id', context.workspaceId)
        .eq('active', true)

      if (listError) throw listError

      // 2. Se houver apenas 1 empresa ativa cadastrada, bloquear
      if (!activeCompanies || activeCompanies.length <= 1) {
        return { ok: false, error: 'Não é permitido inativar a única empresa ativa deste escritório.' }
      }

      // 3. Se for inativar a empresa ativa atual, setar o cookie para a próxima ativa disponível
      if (id === context.companyId) {
        const nextActive = activeCompanies.find(c => c.id !== id)
        if (nextActive) {
          const cookieStore = await cookies()
          const COOKIE_OPTIONS = { path: '/', maxAge: 60 * 60 * 24 * 90, sameSite: 'lax' as const }
          cookieStore.set('current_company_id', nextActive.id, COOKIE_OPTIONS)
        }
      }
    }

    const { data, error } = await db
      .from('companies')
      .update({ active })
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .select('id, active')
      .single()

    if (error || !data) throw error || new Error('Falha ao alterar status da empresa.')

    revalidatePath('/cadastros/empresas')
    revalidatePath('/', 'layout')

    return { ok: true, data: { id: data.id, active: data.active }, message: data.active ? 'Empresa reativada.' : 'Empresa inativada.' }
  } catch (error: any) {
    console.error('Erro ao alterar status da empresa:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
