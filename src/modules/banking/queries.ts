import { getClient } from '@/lib/supabase/server'
import { BankStatementImport, BankStatementLine, BankStatementLineFilters, BankingDashboardData } from './types'

async function getDb() {
  return getClient()
}

export async function getBankingDashboard(companyId: string): Promise<BankingDashboardData> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para o painel de bancos.')
  }

  const db = await getDb()

  const [{ count: bankAccountsCount }, { count: importsCount }, { data: pendingLines }, { data: reconciledLines }, { count: errorLinesCount }] = await Promise.all([
    db.from('bank_accounts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('active', true),
    db.from('bank_statement_imports').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    db.from('bank_statement_lines').select('amount').eq('company_id', companyId).eq('status', 'PENDING'),
    db.from('bank_statement_lines').select('id').eq('company_id', companyId).eq('status', 'RECONCILED')
      .gte('reconciled_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    db.from('bank_statement_lines').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'ERROR')
  ])

  let totalPendingInflow = 0
  let totalPendingOutflow = 0
  ;(pendingLines || []).forEach((line: { amount: number | string }) => {
    const amt = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
    if (isNaN(amt)) return
    if (amt > 0) totalPendingInflow += amt
    else totalPendingOutflow += Math.abs(amt)
  })

  return {
    bankAccountsCount: bankAccountsCount || 0,
    importsCount: importsCount || 0,
    pendingLinesCount: (pendingLines || []).length,
    reconciledThisMonthCount: (reconciledLines || []).length,
    errorLinesCount: errorLinesCount || 0,
    totalPendingInflow,
    totalPendingOutflow
  }
}

export async function listBankStatementImports(companyId: string): Promise<BankStatementImport[]> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para a consulta de importações.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('bank_statement_imports')
    .select('*, bank_account:bank_accounts(bank_name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Falha ao buscar importações de extrato.')
  }

  return (data || []) as BankStatementImport[]
}

export async function listBankStatementLines(companyId: string, filters: BankStatementLineFilters = {}): Promise<BankStatementLine[]> {
  if (!companyId) {
    throw new Error('Nenhuma empresa ativa fornecida para a consulta de linhas de extrato.')
  }

  const db = await getDb()
  let query = db
    .from('bank_statement_lines')
    .select(`
      *,
      bank_account:bank_accounts(bank_name),
      counterparty_account:chart_accounts(code, name),
      partner:partners(name),
      cost_center:cost_centers(code, name),
      journal_entry_line:journal_entry_lines!journal_entry_line_id(journal_entry_id, journal_entry:journal_entries(number, status))
    `)
    .eq('company_id', companyId)

  if (filters.bankAccountId) {
    query = query.eq('bank_account_id', filters.bankAccountId)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.dateFrom) {
    query = query.gte('entry_date', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('entry_date', filters.dateTo)
  }
  if (filters.text) {
    query = query.ilike('description', `%${filters.text}%`)
  }

  const { data, error } = await query.order('entry_date', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Falha ao buscar linhas de extrato.')
  }

  return (data || []) as unknown as BankStatementLine[]
}

export async function getBankStatementLineById(id: string, companyId: string): Promise<BankStatementLine | null> {
  if (!id || !companyId) {
    throw new Error('ID de linha e empresa ativa são obrigatórios.')
  }

  const db = await getDb()
  const { data, error } = await db
    .from('bank_statement_lines')
    .select(`
      *,
      bank_account:bank_accounts(bank_name),
      counterparty_account:chart_accounts(code, name),
      partner:partners(name),
      cost_center:cost_centers(code, name),
      journal_entry_line:journal_entry_lines!journal_entry_line_id(journal_entry_id, journal_entry:journal_entries(number, status))
    `)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Falha ao buscar a linha de extrato.')
  }

  return data as unknown as BankStatementLine | null
}

export async function listCostCentersForClassification(companyId: string) {
  if (!companyId) return []

  const db = await getDb()
  const { data, error } = await db
    .from('cost_centers')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('code', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Falha ao buscar centros de custo.')
  }

  return data || []
}

/**
 * Busca lançamentos POSTED cuja linha tocando a conta contábil do banco tenha o mesmo
 * sentido (débito/crédito) e valor aproximado da linha de extrato, dentro de uma janela
 * de datas — candidatos para "vincular a lançamento existente" em vez de gerar um novo.
 */
export async function searchJournalEntryLinesForLinking(params: {
  companyId: string
  bankChartAccountId: string
  amount: number
  entryDate: string
  windowDays?: number
}) {
  const { companyId, bankChartAccountId, amount, entryDate, windowDays = 15 } = params
  if (!companyId || !bankChartAccountId) return []

  const db = await getDb()
  const debitCredit = amount > 0 ? 'DEBIT' : 'CREDIT'
  const absAmount = Math.abs(amount)

  const baseDate = new Date(entryDate + 'T00:00:00')
  const fromDate = new Date(baseDate)
  fromDate.setDate(fromDate.getDate() - windowDays)
  const toDate = new Date(baseDate)
  toDate.setDate(toDate.getDate() + windowDays)

  const { data, error } = await db
    .from('journal_entry_lines')
    .select('id, journal_entry_id, debit_credit, amount, journal_entries!inner(id, number, entry_date, description, status, company_id)')
    .eq('company_id', companyId)
    .eq('account_id', bankChartAccountId)
    .eq('debit_credit', debitCredit)
    .gte('amount', (absAmount - 0.01).toFixed(2))
    .lte('amount', (absAmount + 0.01).toFixed(2))
    .eq('journal_entries.status', 'POSTED')
    .gte('journal_entries.entry_date', fromDate.toISOString().substring(0, 10))
    .lte('journal_entries.entry_date', toDate.toISOString().substring(0, 10))
    .is('bank_statement_line_id', null)

  if (error) {
    throw new Error(error.message || 'Falha ao buscar lançamentos candidatos para vínculo.')
  }

  return data || []
}
