import { getClient } from '@/lib/supabase/server'
import { ClosingStatus, ClosingPreviewData, ClosingPreviewItem } from './types'

// Padrão de pontuação de conta destino de PL
function getEquityAccountScore(name: string): number {
  const lowercase = name.toLowerCase()
  if (lowercase.includes('lucros ou prejuizos acumulados') || lowercase.includes('lucro ou prejuizo acumulado')) return 100
  if (lowercase.includes('lucros acumulados') || lowercase.includes('lucro acumulado')) return 90
  if (lowercase.includes('prejuizos acumulados') || lowercase.includes('prejuizo acumulado')) return 80
  if (lowercase.includes('resultado acumulado') || lowercase.includes('resultados acumulados')) return 70
  if (lowercase.includes('resultado do exercicio') || lowercase.includes('resultado do periodo')) return 60
  if (lowercase.includes('lucros/prejuizos') || lowercase.includes('lucro/prejuizo')) return 50
  if (lowercase.includes('lucros') || lowercase.includes('lucro')) return 40
  if (lowercase.includes('resultado')) return 30
  return 10
}

/**
 * Busca o status de encerramento da competência ativa.
 */
export async function getClosingStatus(companyId: string, competence: string): Promise<ClosingStatus> {
  const db = await getClient()

  // 1. Busca status do período contábil
  const competenceStart = `${competence.substring(0, 7)}-01`
  const { data: period } = await db
    .from('accounting_periods')
    .select('status')
    .eq('company_id', companyId)
    .eq('competence', competenceStart)
    .single()

  const periodStatus = period?.status || 'OPEN'

  // 2. Verifica se há rascunhos (DRAFT) na competência
  const { count: draftsCount } = await db
    .from('journal_entries')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('competence', competenceStart)
    .eq('status', 'DRAFT')

  const hasDrafts = (draftsCount || 0) > 0

  // 3. Verifica se já existe um lançamento de encerramento POSTED ou DRAFT (que não esteja REVERSED)
  const { data: closingEntry } = await db
    .from('journal_entries')
    .select('id, number, status')
    .eq('company_id', companyId)
    .eq('competence', competenceStart)
    .eq('origin', 'RESULT_CLOSING')
    .neq('status', 'REVERSED')
    .limit(1)
    .maybeSingle()

  const hasClosing = !!closingEntry

  // 4. Busca e pontua a melhor conta contábil de destino do Patrimônio Líquido
  const { data: accounts } = await db
    .from('chart_accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('account_type', 'EQUITY')
    .eq('is_synthetic', false)
    .eq('is_active', true)

  const candidates = accounts || []
  const sorted = [...candidates].sort((a, b) => getEquityAccountScore(b.name) - getEquityAccountScore(a.name))
  const equityResultAccount = sorted[0] || null

  return {
    periodStatus,
    hasDrafts,
    hasClosing,
    closingEntryId: closingEntry?.id,
    closingEntryNumber: closingEntry?.number,
    equityResultAccount,
    draftsCount: draftsCount || 0
  }
}

/**
 * Calcula e gera a prévia de zeramento das contas de resultado do período contábil selecionado.
 */
export async function getClosingPreview(
  companyId: string,
  competence: string,
  targetAccountId: string | null
): Promise<ClosingPreviewData> {
  const db = await getClient()

  const competenceStart = `${competence.substring(0, 7)}-01`

  // 1. Busca todas as contas de resultado da empresa
  const { data: accounts } = await db
    .from('chart_accounts')
    .select('id, code, name, account_type, normal_balance')
    .eq('company_id', companyId)
    .in('account_type', ['REVENUE', 'REVENUE_DEDUCTION', 'COST', 'EXPENSE'])
    .eq('is_synthetic', false)
    .eq('is_active', true)

  const chartAccounts = accounts || []

  // 2. Busca todas as linhas de lançamentos POSTED da competência pertencentes a essas contas
  const accountIds = chartAccounts.map(a => a.id)
  
  let entryLines: any[] = []
  if (accountIds.length > 0) {
    const { data: lines } = await db
      .from('journal_entry_lines')
      .select('amount, debit_credit, account_id, journal_entries!inner(status, competence)')
      .in('account_id', accountIds)
      .eq('journal_entries.company_id', companyId)
      .eq('journal_entries.status', 'POSTED')
      .eq('journal_entries.competence', competenceStart)
      
    entryLines = lines || []
  }

  // 3. Agrupa e calcula o saldo de movimento assinado por conta
  const balanceMap = new Map<string, number>()
  entryLines.forEach((line) => {
    const amt = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
    if (isNaN(amt)) return

    const current = balanceMap.get(line.account_id) || 0
    if (line.debit_credit === 'DEBIT') {
      balanceMap.set(line.account_id, current + amt)
    } else {
      balanceMap.set(line.account_id, current - amt)
    }
  })

  // 4. Monta a prévia de itens de zeramento
  const previewItems: ClosingPreviewItem[] = []
  let totalRevenue = 0
  let totalDeductions = 0
  let totalCosts = 0
  let totalExpenses = 0
  
  let totalDebits = 0
  let totalCredits = 0

  chartAccounts.forEach((acc) => {
    const signedAmount = balanceMap.get(acc.id) || 0
    
    // Ignora contas contábeis cujo movimento assinado do período é estritamente zero
    if (Math.abs(signedAmount) < 0.009) {
      return
    }

    // Classifica para os resumos
    const absVal = Math.abs(signedAmount)
    if (acc.account_type === 'REVENUE') {
      // Receita acumulada (normal credor, sinal negativo no assinado)
      totalRevenue += -signedAmount
    } else if (acc.account_type === 'REVENUE_DEDUCTION') {
      totalDeductions += signedAmount
    } else if (acc.account_type === 'COST') {
      totalCosts += signedAmount
    } else if (acc.account_type === 'EXPENSE') {
      totalExpenses += signedAmount
    }

    // Regra de Zeramento:
    // Se saldo assinado > 0 (Devedor), zera lançando CRÉDITO na conta de resultado
    // Se saldo assinado < 0 (Credor), zera lançando DÉBITO na conta de resultado
    let debitAmount = 0
    let creditAmount = 0

    if (signedAmount > 0) {
      creditAmount = signedAmount
      totalDebits += signedAmount // A contrapartida no PL será Débito (Despesa)
    } else {
      debitAmount = absVal
      totalCredits += absVal // A contrapartida no PL será Crédito (Receita)
    }

    previewItems.push({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      account_type: acc.account_type,
      normal_balance: acc.normal_balance,
      signedAmount,
      debitAmount,
      creditAmount
    })
  })

  const netResult = totalRevenue - totalDeductions - totalCosts - totalExpenses
  
  // Adiciona a perna líquida de PL para balancear o lançamento
  if (Math.abs(netResult) > 0.009) {
    if (netResult > 0) {
      // Lucro: Crédito no PL (Patrimônio aumenta)
      totalCredits += netResult
    } else {
      // Prejuízo: Débito no PL (Patrimônio diminui)
      totalDebits += Math.abs(netResult)
    }
  }

  // Busca detalhes da conta contábil alvo (se enviada)
  let targetAccount = null
  if (targetAccountId) {
    const { data: ta } = await db
      .from('chart_accounts')
      .select('id, code, name')
      .eq('id', targetAccountId)
      .single()
    if (ta) {
      targetAccount = ta
    }
  }

  return {
    items: previewItems,
    totalRevenue,
    totalDeductions,
    totalCosts,
    totalExpenses,
    netResult,
    totalLines: previewItems.length + (Math.abs(netResult) > 0.009 ? 1 : 0),
    totalDebits,
    totalCredits,
    targetAccount
  }
}
