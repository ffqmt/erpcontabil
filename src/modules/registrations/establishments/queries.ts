import { getClient } from '@/lib/supabase/server'
import { Establishment } from './types'

export async function listEstablishments(companyId: string): Promise<Establishment[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')

  const db = await getClient()
  const { data, error } = await db
    .from('establishments')
    .select('*')
    .eq('company_id', companyId)
    .order('type', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message || 'Falha ao buscar estabelecimentos.')
  return (data || []) as Establishment[]
}

export async function getEstablishmentById(id: string, companyId: string): Promise<Establishment | null> {
  if (!id || !companyId) throw new Error('ID de estabelecimento e empresa ativa são obrigatórios.')

  const db = await getClient()
  const { data, error } = await db
    .from('establishments')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Falha ao buscar o estabelecimento.')
  return (data as Establishment) || null
}
