import { getClient } from '@/lib/supabase/server'
import { Item } from './types'

async function getDb() {
  return getClient()
}

export type ItemOption = Pick<Item, 'id' | 'code' | 'name' | 'description' | 'active'>

export async function getItems(companyId: string): Promise<Item[]> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para a consulta de produtos/serviços.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('items')
    .select('*')
    .eq('company_id', companyId)
    .order('code', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Falha ao buscar produtos/serviços.')
  }

  return (data || []) as Item[]
}

export async function getItemOptions(
  companyId: string,
  options: { activeOnly?: boolean; limit?: number } = {}
): Promise<ItemOption[]> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para a consulta de produtos/serviços.')
  }

  const db = await getDb()
  let query = db
    .from('items')
    .select('id, code, name, description, active')
    .eq('company_id', companyId)

  if (options.activeOnly) query = query.eq('active', true)

  const { data, error } = await query
    .order('code', { ascending: true })
    .limit(options.limit ?? 500)

  if (error) {
    throw new Error(error.message || 'Falha ao buscar produtos/serviços.')
  }

  return (data || []) as ItemOption[]
}

export async function getItemById(id: string, companyId: string): Promise<Item | null> {
  if (!id || !companyId) {
    throw new Error('ID de item e empresa ativa são obrigatórios.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('items')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Falha ao buscar o item.')
  }

  return data as Item | null
}
