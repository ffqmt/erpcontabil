import { getClient } from '@/lib/supabase/server'
import { ChartAccount } from '../accounts/types'
import { JournalEntryLine } from '../journal/types'

export interface DreRawData {
  accounts: ChartAccount[]
  lines: JournalEntryLine[]
}

/**
 * Busca dados brutos no Supabase necessários para calcular a DRE da competência ativa:
 * 1. As contas contábeis de resultado (Receitas, Deduções, Custos, Despesas).
 * 2. As linhas de lançamentos POSTED vinculadas à competência ativa.
 */
export async function getDreRawData(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<DreRawData> {
  if (!companyId || !startDate || !endDate) {
    throw new Error('Empresa, Data Inicial e Data Final são obrigatórias para consulta na DRE.')
  }

  const db = await getClient()

  try {
    // 1. Busca todas as contas de resultado da empresa
    const { data: accountsData, error: accountsError } = await db
      .from('chart_accounts')
      .select('*')
      .eq('company_id', companyId)
      .in('account_type', ['REVENUE', 'REVENUE_DEDUCTION', 'COST', 'EXPENSE'])
      .order('code', { ascending: true })

    if (accountsError) throw accountsError
    const accounts = (accountsData || []) as ChartAccount[]

    // 2. Busca cabeçalhos das journal_entries POSTED no período selecionado
    // Exclui lançamentos de origem RESULT_CLOSING: são o zeramento contábil das contas de
    // resultado e não devem ser contados na apuração econômica, sob pena de anular o
    // resultado histórico da DRE após o encerramento da competência.
    const { data: entries, error: entriesError } = await db
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'POSTED')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .neq('origin', 'RESULT_CLOSING')

    if (entriesError) throw entriesError
    const entryIds = (entries || []).map((e) => e.id)

    // 3. Busca todas as linhas dos lançamentos ativos correspondentes às contas de resultado
    let lines: JournalEntryLine[] = []
    if (entryIds.length > 0 && accounts.length > 0) {
      const accountIds = accounts.map((a) => a.id)
      const { data: linesData, error: linesError } = await db
        .from('journal_entry_lines')
        .select('*')
        .in('journal_entry_id', entryIds)
        .in('account_id', accountIds)

      if (linesError) throw linesError
      lines = linesData as JournalEntryLine[]
    }

    return {
      accounts,
      lines
    }
  } catch (err: any) {
    console.error('Erro na execução das queries da DRE:', err)
    throw new Error(err.message || 'Falha ao buscar dados contábeis para a DRE.')
  }
}
