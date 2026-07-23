import { getClient } from '@/lib/supabase/server'
import { FiscalOperationNature } from './types'

async function getDb() {
  return getClient()
}

export type FiscalNatureOption = Pick<FiscalOperationNature, 'id' | 'code' | 'name' | 'is_active'>

export async function getFiscalNatures(companyId: string): Promise<FiscalOperationNature[]> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para a consulta de naturezas fiscais.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('fiscal_operation_natures')
    .select('*')
    .eq('company_id', companyId)
    .order('code', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Falha ao buscar naturezas fiscais.')
  }

  return (data || []) as FiscalOperationNature[]
}

export async function getFiscalNatureOptions(
  companyId: string,
  options: { activeOnly?: boolean; limit?: number } = {}
): Promise<FiscalNatureOption[]> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para a consulta de naturezas fiscais.')
  }

  const db = await getDb()
  let query = db
    .from('fiscal_operation_natures')
    .select('id, code, name, is_active')
    .eq('company_id', companyId)

  if (options.activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
    .order('code', { ascending: true })
    .limit(options.limit ?? 500)

  if (error) {
    throw new Error(error.message || 'Falha ao buscar naturezas fiscais.')
  }

  return (data || []) as FiscalNatureOption[]
}

export async function getFiscalNatureById(id: string, companyId: string): Promise<FiscalOperationNature | null> {
  if (!id || !companyId) {
    throw new Error('ID de natureza fiscal e empresa ativa são obrigatórios.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('fiscal_operation_natures')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Falha ao buscar a natureza fiscal.')
  }

  return data as FiscalOperationNature | null
}
