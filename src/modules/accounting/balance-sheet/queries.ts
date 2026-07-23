import { getClient } from '@/lib/supabase/server'
import { ChartAccount } from '../accounts/types'
import { JournalEntryLine } from '../journal/types'

export interface BalanceSheetRawData {
  accounts: ChartAccount[]
  lines: JournalEntryLine[]
  hasClosing: boolean
  closingEntryNumber?: string | number
}

/**
 * Busca dados brutos no Supabase acumulados até o corte do Balanço Patrimonial:
 * 1. O plano de contas completo de todas as contas (patrimoniais e resultado).
 * 2. As linhas de lançamentos POSTED cuja data de entrada seja anterior ao primeiro dia da próxima competência.
 */
export async function getBalanceSheetRawData(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<BalanceSheetRawData> {
  if (!companyId || !startDate || !endDate) {
    throw new Error('Empresa, Data Inicial e Data Final são obrigatórias para consulta no Balanço Patrimonial.')
  }

  const db = await getClient()

  try {
    // 1. Busca o plano de contas completo da empresa
    const { data: accountsData, error: accountsError } = await db
      .from('chart_accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('code', { ascending: true })

    if (accountsError) throw accountsError
    const accounts = (accountsData || []) as ChartAccount[]

    // 2. Busca cabeçalhos das journal_entries POSTED da empresa com entry_date <= endDate
    const { data: entries, error: entriesError } = await db
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'POSTED')
      .lte('entry_date', endDate)

    if (entriesError) throw entriesError
    const entryIds = (entries || []).map((e) => e.id)

    // 3. Busca todas as linhas dos lançamentos contábeis acumulados
    let lines: JournalEntryLine[] = []
    if (entryIds.length > 0) {
      const { data: linesData, error: linesError } = await db
        .from('journal_entry_lines')
        .select('*')
        .in('journal_entry_id', entryIds)
      
      if (linesError) throw linesError
      lines = linesData as JournalEntryLine[]
    }

    // 4. Verifica se há encerramento postado para a competência correspondente à data final
    const competenceStart = `${endDate.substring(0, 7)}-01`
    const { data: closing } = await db
      .from('journal_entries')
      .select('number')
      .eq('company_id', companyId)
      .eq('competence', competenceStart)
      .eq('origin', 'RESULT_CLOSING')
      .eq('status', 'POSTED')
      .limit(1)
      .maybeSingle()

    const hasClosing = !!closing
    const closingEntryNumber = closing?.number || undefined

    return {
      accounts,
      lines,
      hasClosing,
      closingEntryNumber
    }
  } catch (err: any) {
    console.error('Erro na execução das queries do Balanço Patrimonial:', err)
    throw new Error(err.message || 'Falha ao buscar dados contábeis para o Balanço.')
  }
}
