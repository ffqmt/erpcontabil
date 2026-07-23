import { getClient } from '@/lib/supabase/server'
import { JournalEntry, JournalEntryLine } from './types'

async function getDb() {
  return getClient()
}

type AccountLookup = {
  id: string
  code: string
  name: string
  account_type: string
}

type CostCenterLookup = {
  id: string
  code: string
  name: string
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export interface JournalEntryDateRangeFilter {
  competence?: string
  startDate?: string
  endDate?: string
}

function normalizeCompetence(competence: string): string {
  const date = new Date(`${competence}T00:00:00`)
  if (isNaN(date.getTime())) return competence
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

function lastDayOfMonth(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
}

function isDateOnly(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function resolveDateRange(filter: string | JournalEntryDateRangeFilter): Required<Pick<JournalEntryDateRangeFilter, 'startDate' | 'endDate'>> {
  if (typeof filter === 'string') {
    const competence = normalizeCompetence(filter)
    return { startDate: competence, endDate: lastDayOfMonth(competence) }
  }

  const competence = filter.competence ? normalizeCompetence(filter.competence) : null
  const startDate = isDateOnly(filter.startDate) ? filter.startDate : competence
  const endDate = isDateOnly(filter.endDate) ? filter.endDate : competence ? lastDayOfMonth(competence) : null

  if (!startDate || !endDate) {
    throw new Error('Informe uma competência ou um intervalo de datas para consultar lançamentos contábeis.')
  }

  return startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate }
}

/**
 * Busca todos os lançamentos POSTED para uma determinada empresa e competência.
 * Implementa estratégia de multi-queries de alta robustez, contornando limitações
 * de relacionamentos dinâmicos ou RLS no Supabase.
 */
export async function getJournalEntries(
  companyId: string,
  competence: string
): Promise<JournalEntry[]> {
  if (!companyId || !competence) {
    throw new Error('Empresa e Competência Ativas são obrigatórias para consulta no diário.')
  }

  // Normaliza competência para garantir YYYY-MM-01
  let targetCompetence = competence
  const date = new Date(competence + 'T00:00:00')
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    targetCompetence = `${year}-${month}-01`
  }

  const db = await getDb()

  try {
    // 1. Busca os cabeçalhos das journal_entries POSTED no período
    const { data: entriesData, error: entriesError } = await db
      .from('journal_entries')
      .select('*')
      .eq('company_id', companyId)
      .eq('competence', targetCompetence)
      .eq('status', 'POSTED')
      .order('entry_date', { ascending: true })
      .order('number', { ascending: true })

    if (entriesError) throw entriesError
    if (!entriesData || entriesData.length === 0) return []

    const entryIds = entriesData.map((e) => e.id)

    // 2. Busca todas as linhas de forma otimizada com operador IN
    const { data: linesData, error: linesError } = await db
      .from('journal_entry_lines')
      .select('*')
      .in('journal_entry_id', entryIds)

    if (linesError) throw linesError
    const lines = (linesData || []) as JournalEntryLine[]

    // 3. Resolve os detalhes das contas contábeis
    const accountIds = Array.from(new Set(lines.map((l) => l.account_id)))
    let accounts: AccountLookup[] = []
    if (accountIds.length > 0) {
      const { data: accData, error: accError } = await db
        .from('chart_accounts')
        .select('id, code, name, account_type')
        .in('id', accountIds)
      if (accError) throw accError
      accounts = accData || []
    }
    const accountsMap = new Map(accounts.map((a) => [a.id, a]))

    // 4. Resolve centros de custo vinculados
    const ccIds = Array.from(
      new Set(lines.map((l) => l.cost_center_id).filter(Boolean))
    )
    let costCenters: CostCenterLookup[] = []
    if (ccIds.length > 0) {
      const { data: ccData, error: ccError } = await db
        .from('cost_centers')
        .select('id, code, name')
        .in('id', ccIds)
      if (ccError) throw ccError
      costCenters = ccData || []
    }
    const ccMap = new Map(costCenters.map((cc) => [cc.id, cc]))

    // 5. Acopla as linhas a cada cabeçalho
    const result: JournalEntry[] = entriesData.map((entry) => {
      const entryLines = lines
        .filter((line) => line.journal_entry_id === entry.id)
        .map((line) => ({
          ...line,
          account: accountsMap.get(line.account_id) || null,
          cost_center: line.cost_center_id ? ccMap.get(line.cost_center_id) || null : null
        }))

      return {
        ...entry,
        lines: entryLines
      }
    })

    return result
  } catch (err: unknown) {
    console.error('Erro na execução das queries do Diário Contábil:', err)
    throw new Error(errorMessage(err, 'Falha ao buscar lançamentos contábeis.'))
  }
}

/**
 * Busca lançamentos contábeis, independente de status (DRAFT ou POSTED), por intervalo
 * de data do lançamento. Aceita string de competência por compatibilidade com chamadas
 * antigas, convertendo automaticamente para o mês inteiro.
 */
export async function getAllJournalEntries(
  companyId: string,
  filter: string | JournalEntryDateRangeFilter
): Promise<JournalEntry[]> {
  if (!companyId) {
    throw new Error('Empresa ativa é obrigatória para consulta.')
  }

  const { startDate, endDate } = resolveDateRange(filter)

  const db = await getDb()

  try {
    // 1. Busca todos os cabeçalhos do intervalo (DRAFT, POSTED, etc.)
    const { data: entriesData, error: entriesError } = await db
      .from('journal_entries')
      .select('*')
      .eq('company_id', companyId)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('status', { ascending: true })
      .order('entry_date', { ascending: true })

    if (entriesError) throw entriesError
    if (!entriesData || entriesData.length === 0) return []

    const entryIds = entriesData.map((e) => e.id)

    // 2. Busca todas as linhas
    const { data: linesData, error: linesError } = await db
      .from('journal_entry_lines')
      .select('*')
      .in('journal_entry_id', entryIds)

    if (linesError) throw linesError
    const lines = (linesData || []) as JournalEntryLine[]

    // 3. Busca detalhes de contas
    const accountIds = Array.from(new Set(lines.map((l) => l.account_id)))
    let accounts: AccountLookup[] = []
    if (accountIds.length > 0) {
      const { data: accData, error: accError } = await db
        .from('chart_accounts')
        .select('id, code, name, account_type')
        .in('id', accountIds)
      if (accError) throw accError
      accounts = accData || []
    }
    const accountsMap = new Map(accounts.map((a) => [a.id, a]))

    // 4. Busca centros de custo
    const ccIds = Array.from(
      new Set(lines.map((l) => l.cost_center_id).filter(Boolean))
    )
    let costCenters: CostCenterLookup[] = []
    if (ccIds.length > 0) {
      const { data: ccData, error: ccError } = await db
        .from('cost_centers')
        .select('id, code, name')
        .in('id', ccIds)
      if (ccError) throw ccError
      costCenters = ccData || []
    }
    const ccMap = new Map(costCenters.map((cc) => [cc.id, cc]))

    // 5. Acopla dados
    const result: JournalEntry[] = entriesData.map((entry) => {
      const entryLines = lines
        .filter((line) => line.journal_entry_id === entry.id)
        .map((line) => ({
          ...line,
          account: accountsMap.get(line.account_id) || null,
          cost_center: line.cost_center_id ? ccMap.get(line.cost_center_id) || null : null
        }))

      return {
        ...entry,
        lines: entryLines
      }
    })

    return result
  } catch (err: unknown) {
    console.error('Erro na execução das queries de todos os lançamentos:', err)
    throw new Error(errorMessage(err, 'Falha ao buscar lançamentos contábeis.'))
  }
}
