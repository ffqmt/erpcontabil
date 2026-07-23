import { getClient } from '@/lib/supabase/server'
import { State, Municipality } from './types'

async function getDb() {
  return getClient()
}

/**
 * states/municipalities são catálogo de referência GLOBAL (sem workspace_id/company_id) —
 * não há filtro de tenant nestas consultas.
 */
export async function getStates(): Promise<State[]> {
  const db = await getDb()
  const { data, error } = await db.from('states').select('*').order('name', { ascending: true })
  if (error) {
    throw new Error(error.message || 'Falha ao buscar estados.')
  }
  return (data || []) as State[]
}

export async function getMunicipalities(uf?: string): Promise<Municipality[]> {
  const db = await getDb()
  let query = db.from('municipalities').select('*').order('name', { ascending: true })
  if (uf) {
    query = query.eq('uf', uf.toUpperCase())
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message || 'Falha ao buscar municípios.')
  }
  return (data || []) as Municipality[]
}
