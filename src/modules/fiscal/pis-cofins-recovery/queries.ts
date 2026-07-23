import { getClient } from '@/lib/supabase/server'
import { PisCofinsRecoverySettings } from './types'

export async function getPisCofinsRecoverySettings(companyId: string): Promise<PisCofinsRecoverySettings | null> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')

  const db = await getClient()
  const { data, error } = await db
    .from('pis_cofins_recovery_settings')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Falha ao buscar configuração de crédito de PIS/COFINS.')
  return (data as PisCofinsRecoverySettings) || null
}
