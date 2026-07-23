import { getClient } from '@/lib/supabase/server'
import { ChartAccount } from './types'

/**
 * Busca todas as contas do plano de contas de uma empresa específica.
 * Ordena por código contábil de forma alfabética/numérica estruturada.
 */
export async function getAccounts(companyId: string): Promise<ChartAccount[]> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para a consulta do plano de contas.')
  }

  const supabase = await getClient()
  const { data, error } = await supabase
    .from('chart_accounts')
    .select('*')
    .eq('company_id', companyId)
    .order('code', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Falha ao buscar plano de contas.')
  }

  return (data || []) as ChartAccount[]
}
