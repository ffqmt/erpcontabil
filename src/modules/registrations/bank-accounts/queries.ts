import { getClient } from '@/lib/supabase/server'
import { BankAccount } from './types'

async function getDb() {
  return getClient()
}

export async function getBankAccounts(companyId: string): Promise<BankAccount[]> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para a consulta de contas bancárias.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('bank_accounts')
    .select('*, chart_account:chart_accounts(code, name)')
    .eq('company_id', companyId)
    .order('bank_name', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Falha ao buscar contas bancárias.')
  }

  return (data || []) as BankAccount[]
}

export async function getBankAccountById(id: string, companyId: string): Promise<BankAccount | null> {
  if (!id || !companyId) {
    throw new Error('ID de conta bancária e empresa ativa são obrigatórios.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('bank_accounts')
    .select('*, chart_account:chart_accounts(code, name)')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Falha ao buscar a conta bancária.')
  }

  return data as BankAccount | null
}
