import { getClient } from '@/lib/supabase/server'
import { ReconciliationRule } from './types'

async function getDb() {
  return getClient()
}

export async function listReconciliationRules(companyId: string): Promise<ReconciliationRule[]> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para a consulta de regras de conciliação.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('bank_reconciliation_rules')
    .select('*, counterparty_account:chart_accounts(code, name), partner:partners(name)')
    .eq('company_id', companyId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Falha ao buscar regras de conciliação.')
  }

  return (data || []) as unknown as ReconciliationRule[]
}

export async function getReconciliationRuleById(id: string, companyId: string): Promise<ReconciliationRule | null> {
  if (!id || !companyId) {
    throw new Error('ID de regra e empresa ativa são obrigatórios.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('bank_reconciliation_rules')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Falha ao buscar a regra de conciliação.')
  }

  return data as ReconciliationRule | null
}

/**
 * Encontra a melhor regra ativa que casa com a descrição/sentido de uma linha de extrato —
 * mesmo algoritmo do protótipo legado sistema.html (acharRegraExtrato): substring
 * case-insensitive na descrição + sentido compatível (CREDIT/DEBIT/ANY), primeira que casar
 * na ordem de prioridade vence (priority ASC, created_at DESC como desempate). Não acessa
 * nada além de SELECT — nunca gera/altera lançamentos por conta própria.
 */
export async function findMatchingReconciliationRule(
  companyId: string,
  description: string,
  amount: number
): Promise<ReconciliationRule | null> {
  if (!companyId || !description) return null

  const db = await getDb()
  const { data, error } = await db
    .from('bank_reconciliation_rules')
    .select('*, counterparty_account:chart_accounts(code, name), partner:partners(name)')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })

  if (error || !data) return null

  const normalizedDescription = description.toLowerCase()
  const movementDirection = amount > 0 ? 'CREDIT' : 'DEBIT'

  const match = (data as unknown as ReconciliationRule[]).find((rule) => {
    if (rule.direction !== 'ANY' && rule.direction !== movementDirection) return false
    return normalizedDescription.includes(rule.keyword.toLowerCase())
  })

  return match || null
}
