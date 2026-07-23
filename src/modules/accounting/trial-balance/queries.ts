import { getClient } from '@/lib/supabase/server'
import { ChartAccount } from '../accounts/types'
import { JournalEntry, JournalEntryLine } from '../journal/types'

export interface TrialBalanceRawData {
  accounts: ChartAccount[]
  previousLines: JournalEntryLine[]
  periodLines: JournalEntryLine[]
}

/**
 * Busca todos os dados necessários para calcular o Balancete de Verificação:
 * 1. O plano de contas completo da empresa.
 * 2. As linhas de lançamentos POSTED anteriores ao início do período selecionado (saldo anterior).
 * 3. As linhas de lançamentos POSTED pertencentes ao período selecionado (movimento do período).
 */
export async function getTrialBalanceRawData(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<TrialBalanceRawData> {
  if (!companyId || !startDate || !endDate) {
    throw new Error('Empresa, Data Inicial e Data Final são obrigatórias para consulta no balancete.')
  }

  const db = await getClient()

  try {
    // 1. Busca plano de contas completo da empresa
    const { data: accountsData, error: accountsError } = await db
      .from('chart_accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('code', { ascending: true })

    if (accountsError) throw accountsError
    const accounts = (accountsData || []) as ChartAccount[]

    // 2. Busca cabeçalhos dos lançamentos de saldo anterior (entry_date < data inicial)
    const { data: prevEntries, error: prevEntriesError } = await db
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'POSTED')
      .lt('entry_date', startDate)

    if (prevEntriesError) throw prevEntriesError
    const prevIds = (prevEntries || []).map((e) => e.id)

    // 3. Busca cabeçalhos dos lançamentos do período selecionado (entry_date >= startDate AND entry_date <= endDate)
    const { data: periodEntries, error: periodEntriesError } = await db
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'POSTED')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)

    if (periodEntriesError) throw periodEntriesError
    const periodIds = (periodEntries || []).map((e) => e.id)

    // 4. Busca linhas do saldo anterior
    let previousLines: JournalEntryLine[] = []
    if (prevIds.length > 0) {
      const { data: prevLinesData, error: prevLinesError } = await db
        .from('journal_entry_lines')
        .select('*')
        .in('journal_entry_id', prevIds)
      if (prevLinesError) throw prevLinesError
      previousLines = prevLinesData as JournalEntryLine[]
    }

    // 5. Busca linhas do período
    let periodLines: JournalEntryLine[] = []
    if (periodIds.length > 0) {
      const { data: periodLinesData, error: periodLinesError } = await db
        .from('journal_entry_lines')
        .select('*')
        .in('journal_entry_id', periodIds)
      if (periodLinesError) throw periodLinesError
      periodLines = periodLinesData as JournalEntryLine[]
    }

    return {
      accounts,
      previousLines,
      periodLines
    }
  } catch (err: any) {
    console.error('Erro na execução das queries do Balancete de Verificação:', err)
    throw new Error(
      err.message || 'Falha ao buscar dados contábeis para o balancete.'
    )
  }
}
