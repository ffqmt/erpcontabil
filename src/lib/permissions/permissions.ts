import { getCurrentContext } from '../context/current-context'

export type UserRole = 'ADMIN' | 'ACCOUNTANT' | 'BOOKKEEPER' | 'CLIENT'

export interface UserPermissions {
  role: UserRole
  permissions: string[]
}

/**
 * Retorna as permissões e papéis do usuário ativo.
 * Atualmente implementado como stub de desenvolvimento, concedendo acesso administrativo completo.
 * Futuramente lerá os claims do JWT do Francoos/Supabase.
 */
export async function getUserPermissions(): Promise<UserPermissions> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const context = await getCurrentContext()

  return {
    role: 'ADMIN',
    permissions: [
      'accounting:read',
      'accounting:write',
      'accounting:post',
      'reports:read',
      'settings:read',
      'settings:write',
      '*' // Acesso total
    ]
  }
}

/**
 * Verifica se o usuário atual possui uma permissão específica.
 */
export async function hasPermission(permission: string): Promise<boolean> {
  const { permissions } = await getUserPermissions()
  return permissions.includes(permission) || permissions.includes('*')
}

/**
 * Verifica se o usuário atual pertence a um dos papéis informados.
 */
export async function checkRole(roles: UserRole[]): Promise<boolean> {
  const { role } = await getUserPermissions()
  return roles.includes(role)
}

/**
 * Permissões específicas para o controle de períodos contábeis.
 */
export async function canCloseAccountingPeriod(): Promise<boolean> {
  return hasPermission('accounting:period:close')
}

export async function canReopenAccountingPeriod(): Promise<boolean> {
  return hasPermission('accounting:period:reopen')
}

export async function canCloseIncomeStatement(): Promise<boolean> {
  return hasPermission('accounting:closing:write')
}

/**
 * Permissão para gerenciar Cadastros Base (parceiros, itens, naturezas fiscais, contas
 * bancárias). Mesmo stub de desenvolvimento das demais funções acima — concede acesso
 * total via wildcard '*'. Futuramente lerá os claims do JWT do Francoos/Supabase.
 */
export async function canManageRegistrations(): Promise<boolean> {
  return hasPermission('registrations:write')
}

/**
 * Permissões do módulo Bancos e Conciliação (Etapa 18). Mesmo stub de desenvolvimento das
 * demais funções acima — concede acesso total via wildcard '*'. Futuramente lerá os
 * claims do JWT do Francoos/Supabase.
 */
export async function canManageBanking(): Promise<boolean> {
  return hasPermission('banking:write')
}

export async function canImportBankStatements(): Promise<boolean> {
  return hasPermission('banking:import')
}

export async function canReconcileBankStatements(): Promise<boolean> {
  return hasPermission('banking:reconcile')
}

/**
 * Permissão de UI/aplicação para administrar Regras de Mapeamento de Conciliação (Etapa
 * 30A). Distinta de canReconcileBankStatements (operar a conciliação linha a linha):
 * criar/editar/desativar regra é configuração — a RLS real (bank_reconciliation_rules
 * insert/update/delete) usa can_admin_company, mesmo nível de chart_accounts/companies.
 */
export async function canManageReconciliationRules(): Promise<boolean> {
  return hasPermission('banking:rules:write')
}

/**
 * Permissões dos módulos Fiscal/Tributário, Apurações, Obrigações e Patrimônio
 * (Etapas 19–22). Mesmo stub de desenvolvimento das demais funções acima — concede
 * acesso total via wildcard '*'. Futuramente lerão os claims do JWT do Francoos/Supabase.
 */
export async function canManageFiscal(): Promise<boolean> {
  return hasPermission('fiscal:write')
}

export async function canManageTaxAssessments(): Promise<boolean> {
  return hasPermission('tax_assessments:write')
}

export async function canManageObligations(): Promise<boolean> {
  return hasPermission('obligations:write')
}

export async function canManageAssets(): Promise<boolean> {
  return hasPermission('assets:write')
}

export async function canManagePayroll(): Promise<boolean> {
  return hasPermission('payroll:write')
}

export async function canPostFiscalToAccounting(): Promise<boolean> {
  return hasPermission('fiscal:accounting:write')
}

export async function canCloseTaxAssessment(): Promise<boolean> {
  return hasPermission('tax_assessments:close')
}

export async function canGenerateAssetDepreciation(): Promise<boolean> {
  return hasPermission('assets:depreciation:generate')
}

/**
 * Permissão para manutenção do Plano de Contas (criar/editar/inativar/reativar conta
 * contábil). Etapa 28A. Mesmo stub de desenvolvimento das demais funções acima — concede
 * acesso total via wildcard '*'. Futuramente lerá os claims do JWT do Francoos/Supabase.
 * No banco, a escrita real é sempre gated por can_admin_company (RLS) independentemente
 * deste stub — este é só o portão de UI/aplicação.
 */
export async function canManageChartAccounts(): Promise<boolean> {
  return hasPermission('accounting:chart:write')
}

/**
 * Permissão de UI/aplicação para gerenciar o cadastro de Empresas (Etapa 30A). Mesmo stub
 * de desenvolvimento das demais funções acima — a autorização real é sempre imposta pela
 * RLS (companies_insert/company_users_insert exigem can_admin_workspace independentemente
 * deste stub).
 */
export async function canManageCompanies(): Promise<boolean> {
  return hasPermission('companies:write')
}
