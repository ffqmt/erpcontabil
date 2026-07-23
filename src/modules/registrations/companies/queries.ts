import { getClient } from '@/lib/supabase/server'
import { Company } from './types'

async function getDb() {
  return getClient()
}

/**
 * Lista as empresas visíveis ao usuário no workspace ativo. RLS (companies_select ->
 * can_read_company) já filtra para as empresas permitidas — nenhum filtro extra necessário
 * além de workspace_id, que só existe para ordenar/segmentar dentro do mesmo escritório.
 */
export async function getCompanies(workspaceId: string): Promise<Company[]> {
  if (!workspaceId) {
    throw new Error('Nenhum escritório (workspace) ativo fornecido para a consulta de empresas.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('companies')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('legal_name', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Falha ao buscar empresas.')
  }

  return (data || []) as Company[]
}

export async function getCompanyById(id: string, workspaceId: string): Promise<Company | null> {
  if (!id || !workspaceId) {
    throw new Error('ID de empresa e escritório ativo são obrigatórios.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('companies')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Falha ao buscar a empresa.')
  }

  return data as Company | null
}
