import { getClient } from '@/lib/supabase/server'
import { Partner } from './types'

async function getDb() {
  return getClient()
}

export type PartnerOption = Pick<Partner, 'id' | 'name' | 'active'>

/**
 * Busca todos os parceiros de uma empresa, mais recentes primeiro.
 */
export async function getPartners(companyId: string): Promise<Partner[]> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para a consulta de parceiros.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('partners')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Falha ao buscar parceiros.')
  }

  return (data || []) as Partner[]
}

export async function getPartnerOptions(
  companyId: string,
  options: { activeOnly?: boolean; limit?: number } = {}
): Promise<PartnerOption[]> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para a consulta de parceiros.')
  }

  const db = await getDb()
  let query = db
    .from('partners')
    .select('id, name, active')
    .eq('company_id', companyId)

  if (options.activeOnly) query = query.eq('active', true)

  const { data, error } = await query
    .order('name', { ascending: true })
    .limit(options.limit ?? 500)

  if (error) {
    throw new Error(error.message || 'Falha ao buscar parceiros.')
  }

  return (data || []) as PartnerOption[]
}

export async function getPartnerById(id: string, companyId: string): Promise<Partner | null> {
  if (!id || !companyId) {
    throw new Error('ID de parceiro e empresa ativa são obrigatórios.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('partners')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Falha ao buscar o parceiro.')
  }

  return data as Partner | null
}
