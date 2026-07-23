import { getClient } from '@/lib/supabase/server'
import { NcmCode, CestCode, CfopCode, TaxSituationCode, MunicipalServiceCode } from './types'

async function getDb() {
  return getClient()
}

const SEARCH_LIMIT = 100

export async function searchNcmCodes(search?: string): Promise<NcmCode[]> {
  const db = await getDb()
  let query = db.from('ncm_codes').select('id, code, description, active').eq('active', true)
  if (search) query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%`)
  const { data, error } = await query.order('code', { ascending: true }).limit(SEARCH_LIMIT)
  if (error) throw new Error(error.message || 'Falha ao buscar códigos NCM.')
  return (data || []) as NcmCode[]
}

export async function searchCestCodes(search?: string): Promise<CestCode[]> {
  const db = await getDb()
  let query = db.from('cest_codes').select('id, code, ncm_code, segment, description, active').eq('active', true)
  if (search) query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%,ncm_code.ilike.%${search}%`)
  const { data, error } = await query.order('code', { ascending: true }).limit(SEARCH_LIMIT)
  if (error) throw new Error(error.message || 'Falha ao buscar códigos CEST.')
  return (data || []) as CestCode[]
}

export async function searchCfopCodes(search?: string, direction?: 'IN' | 'OUT'): Promise<CfopCode[]> {
  const db = await getDb()
  let query = db.from('cfop_codes').select('id, code, description, direction, operation_scope, active').eq('active', true)
  if (direction) query = query.eq('direction', direction)
  if (search) query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%`)
  const { data, error } = await query.order('code', { ascending: true }).limit(SEARCH_LIMIT)
  if (error) throw new Error(error.message || 'Falha ao buscar códigos CFOP.')
  return (data || []) as CfopCode[]
}

export async function searchTaxSituationCodes(taxFamily?: string, search?: string): Promise<TaxSituationCode[]> {
  const db = await getDb()
  let query = db.from('tax_situation_codes').select('id, tax_family, code, description, regime, credit_allowed, active').eq('active', true)
  if (taxFamily) query = query.eq('tax_family', taxFamily)
  if (search) query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%`)
  const { data, error } = await query.order('tax_family', { ascending: true }).order('code', { ascending: true }).limit(SEARCH_LIMIT)
  if (error) throw new Error(error.message || 'Falha ao buscar códigos de situação tributária.')
  return (data || []) as TaxSituationCode[]
}

export async function searchMunicipalServiceCodes(search?: string): Promise<MunicipalServiceCode[]> {
  const db = await getDb()
  let query = db.from('municipal_service_codes').select('id, municipality_code, national_service_code, municipal_service_code, description, active').eq('active', true)
  if (search) query = query.or(`municipal_service_code.ilike.%${search}%,description.ilike.%${search}%,national_service_code.ilike.%${search}%`)
  const { data, error } = await query.order('municipal_service_code', { ascending: true }).limit(SEARCH_LIMIT)
  if (error) throw new Error(error.message || 'Falha ao buscar códigos de serviço municipal.')
  return (data || []) as MunicipalServiceCode[]
}
