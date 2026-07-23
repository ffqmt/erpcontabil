import { getClosingStatus } from '@/modules/accounting/closing/queries'
import { getAllJournalEntries } from '@/modules/accounting/journal/queries'
import { getDreRawData } from '@/modules/accounting/dre/queries'
import { calculateDre } from '@/modules/accounting/dre/dre-calculator'
import { getBalanceSheetRawData } from '@/modules/accounting/balance-sheet/queries'
import { calculateBalanceSheet } from '@/modules/accounting/balance-sheet/balance-sheet-calculator'
import { AccountingDashboardData } from './types'

/**
 * Agrega e calcula todos os KPIs, alertas e listagens necessárias para o Dashboard Contábil.
 * Reaproveita os mecanismos de cálculo oficiais da DRE e do Balanço Patrimonial.
 */
export async function getAccountingDashboardData(
  companyId: string,
  competence: string,
  workspaceId: string
): Promise<AccountingDashboardData> {
  if (!companyId || !competence) {
    throw new Error('Empresa e Competência Ativas são obrigatórias para carregar o Dashboard.')
  }

  // Calcula valores de período baseados na competência
  const competenceDate = new Date(competence + 'T00:00:00')
  const lastDay = new Date(competenceDate.getFullYear(), competenceDate.getMonth() + 1, 0)
  const startDate = competence
  const endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

  // 1. Busca status do período contábil e conta destino de PL
  const status = await getClosingStatus(companyId, competence)

  // 2. Busca todos os lançamentos (Draft, Posted, Reversed) do período
  const entries = await getAllJournalEntries(companyId, competence)
  
  const draftsCount = entries.filter(e => e.status === 'DRAFT').length
  const postedCount = entries.filter(e => e.status === 'POSTED').length
  const reversedCount = entries.filter(e => e.status === 'REVERSED').length
  const totalEntries = entries.length

  // Ordena lançamentos recentes por data (e ID para desempate) e pega os 5 primeiros
  const recentEntries = [...entries]
    .sort((a, b) => {
      const dateDiff = new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      if (dateDiff !== 0) return dateDiff
      return (b.number || '').toString().localeCompare((a.number || '').toString())
    })
    .slice(0, 5)

  // 3. Busca e calcula a DRE (Resultado)
  let dreReport = null
  try {
    const dreRaw = await getDreRawData(companyId, startDate, endDate)
    dreReport = calculateDre(dreRaw, endDate)
  } catch (err: any) {
    console.error('Falha ao calcular DRE para o Dashboard:', err)
    throw new Error('Erro ao processar as contas de resultado da DRE.')
  }

  // 4. Busca e calcula o Balanço Patrimonial
  let balanceSheetReport = null
  try {
    const bsRaw = await getBalanceSheetRawData(companyId, startDate, endDate)
    balanceSheetReport = calculateBalanceSheet(bsRaw, endDate)
  } catch (err: any) {
    console.error('Falha ao calcular Balanço para o Dashboard:', err)
    throw new Error('Erro ao processar a situação patrimonial do Balanço.')
  }

  // 5. Consolidação de Alertas Contábeis
  const alerts: string[] = []

  if (draftsCount > 0) {
    alerts.push(`Existem ${draftsCount} lançamento(s) em Rascunho (DRAFT) pendente(s) na competência.`)
  }

  if (status.periodStatus === 'CLOSED') {
    alerts.push('O período contábil deste mês encontra-se FECHADO. Lançamentos adicionais estão suspensos.')
  } else if (status.periodStatus === 'IN_REVIEW') {
    alerts.push('O período contábil encontra-se EM REVISÃO. Revise as demonstrações.')
  } else if (status.periodStatus === 'REOPENED') {
    alerts.push('A competência contábil foi reaberta. Certifique-se de fechar após realizar os ajustes.')
  }

  if (!balanceSheetReport.isBalanced) {
    const diffVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(balanceSheetReport.difference))
    alerts.push(`Divergência Patrimonial: O total de Ativos difere do total de Passivos + PL por ${diffVal}.`)
  }

  if (!status.equityResultAccount) {
    alerts.push('Alerta de Setup: Nenhuma conta analítica ativa do PL (EQUITY) para receber o encerramento foi identificada.')
  }

  if (!status.hasClosing && totalEntries > 0 && Math.abs(dreReport.netProfit) > 0.009) {
    alerts.push('O resultado do período ainda não foi encerrado fisicamente para o Patrimônio Líquido.')
  }

  if (totalEntries === 0) {
    alerts.push('Sem lançamentos: A empresa ainda não registrou lançamentos contábeis nesta competência.')
  }

  return {
    competence,
    periodStatus: status.periodStatus,
    hasClosing: status.hasClosing,
    closingEntryNumber: status.closingEntryNumber,
    equityResultAccount: status.equityResultAccount,
    draftsCount,
    postedCount,
    reversedCount,
    totalEntries,
    recentEntries,
    dre: dreReport,
    balanceSheet: balanceSheetReport,
    alerts
  }
}
