import { getClient, createServerAdminClient } from '@/lib/supabase/server'
import { AccountingPeriod } from './types'

type PeriodLineAggregate = {
  amount: number | string
  debit_credit: 'DEBIT' | 'CREDIT'
  journal_entries?: { competence?: string | null } | Array<{ competence?: string | null }> | null
}

/**
 * Busca todos os períodos contábeis da empresa ativa com agregações de estatísticas de lançamentos:
 * - Quantidade de lançamentos POSTED
 * - Quantidade de lançamentos DRAFT
 * - Soma total de débitos e créditos
 */
export async function getAccountingPeriods(companyId: string): Promise<AccountingPeriod[]> {
  const db = await getClient()

  try {
    // 1. Busca os períodos contábeis da empresa ordenados pela data de competência decrescente
    const { data: periodsData, error: periodsError } = await db
      .from('accounting_periods')
      .select('*')
      .eq('company_id', companyId)
      .order('competence', { ascending: false })

    if (periodsError) throw periodsError
    const periods = (periodsData || []) as AccountingPeriod[]

    if (periods.length === 0) return []

    // 2. Busca contagem de lançamentos por competência
    const { data: entryStats, error: statsError } = await db
      .from('journal_entries')
      .select('competence, status, id')
      .eq('company_id', companyId)

    if (statsError) throw statsError
    const statsList = entryStats || []

    // 3. Busca somas totais de débitos/créditos agrupados por competência
    const { data: linesData, error: linesError } = await db
      .from('journal_entry_lines')
      .select('amount, debit_credit, journal_entries!inner(competence, status)')
      .eq('company_id', companyId)
      .eq('journal_entries.status', 'POSTED')

    if (linesError) throw linesError
    const linesList = linesData || []
    const typedLinesList = linesList as PeriodLineAggregate[]

    // 4. Mapeia e combina os dados no servidor Next.js
    return periods.map((period) => {
      const competenceStr = period.competence

      // Contadores de lançamentos
      const postedCount = statsList.filter((e) => e.competence === competenceStr && e.status === 'POSTED').length
      const draftCount = statsList.filter((e) => e.competence === competenceStr && e.status === 'DRAFT').length

      // Somas monetárias
      let totalDebits = 0
      let totalCredits = 0

      typedLinesList.forEach((line) => {
        const journalEntry = Array.isArray(line.journal_entries) ? line.journal_entries[0] : line.journal_entries
        if (journalEntry?.competence === competenceStr) {
          const amt = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
          if (line.debit_credit === 'DEBIT') {
            totalDebits += amt
          } else {
            totalCredits += amt
          }
        }
      })

      return {
        ...period,
        posted_count: postedCount,
        draft_count: draftCount,
        total_debits: totalDebits,
        total_credits: totalCredits
      }
    })
  } catch (err) {
    console.error('Erro na query de períodos contábeis:', err)
    throw err
  }
}

/**
 * Busca a competência contábil ativa e seu status.
 * Caso a competência não possua registro correspondente na tabela,
 * o sistema realiza a autocriação do período contábil OPEN no banco de dados.
 */
export async function getCurrentAccountingPeriod(
  companyId: string,
  competence: string,
  workspaceId: string
): Promise<AccountingPeriod> {
  const db = await getClient()

  // Normaliza a data da competência YYYY-MM-01
  let targetCompetence = competence
  const dateObj = new Date(competence + 'T00:00:00')
  if (!isNaN(dateObj.getTime())) {
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    targetCompetence = `${year}-${month}-01`
  }

  try {
    const { data: period, error: findError } = await db
      .from('accounting_periods')
      .select('*')
      .eq('company_id', companyId)
      .eq('competence', targetCompetence)
      .maybeSingle()

    if (findError) throw findError

    if (period) {
      return period as AccountingPeriod
    }

    // Autocriação de Período Contábil aberto
    const year = dateObj.getFullYear()
    const month = dateObj.getMonth() + 1
    const lastDay = new Date(year, month, 0).getDate()
    
    const startDate = targetCompetence
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data: newPeriod, error: insertError } = await db
      .from('accounting_periods')
      .insert({
        workspace_id: workspaceId,
        company_id: companyId,
        competence: targetCompetence,
        start_date: startDate,
        end_date: endDate,
        status: 'OPEN'
      })
      .select('*')
      .single()

    if (insertError) {
      console.warn('Erro ao auto-criar período com Anon. Tentando com Admin (exceção de infraestrutura legítima)...', insertError)
      const adminDb = createServerAdminClient()
      const { data: adminNewPeriod, error: adminInsertError } = await adminDb
        .from('accounting_periods')
        .insert({
          workspace_id: workspaceId,
          company_id: companyId,
          competence: targetCompetence,
          start_date: startDate,
          end_date: endDate,
          status: 'OPEN'
        })
        .select('*')
        .single()
      
      if (adminInsertError) throw adminInsertError
      return adminNewPeriod as AccountingPeriod
    }

    return newPeriod as AccountingPeriod
  } catch (err) {
    console.error('Erro ao buscar/auto-criar período atual:', err)
    throw err
  }
}

export async function getAccountingPeriodStatusMap(companyId: string, competencies: string[]): Promise<Record<string, AccountingPeriod['status']>> {
  if (!companyId || competencies.length === 0) return {}

  const uniqueCompetencies = Array.from(new Set(competencies.filter(Boolean)))
  if (uniqueCompetencies.length === 0) return {}

  const db = await getClient()
  const { data, error } = await db
    .from('accounting_periods')
    .select('competence, status')
    .eq('company_id', companyId)
    .in('competence', uniqueCompetencies)

  if (error) throw error

  return Object.fromEntries((data || []).map((period) => [period.competence as string, period.status as AccountingPeriod['status']]))
}
