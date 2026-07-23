import { BalanceSheetRawData } from './queries'
import { BalanceSheetReportData, BalanceSheetItem } from './types'

/**
 * Calcula o Balanço Patrimonial acumulado até o final do período contábil ativo.
 * 
 * Estratégia de Fechamento sem Encerramento Físico:
 * 1. Calcula o saldo líquido acumulado de todas as contas de resultado (Receitas, Deduções, Custos, Despesas).
 *    Este saldo representa o Lucro ou Prejuízo Acumulado gerado no período que ainda não foi encerrado no banco.
 * 2. Insere este saldo apurado como uma linha especial e calculada sob o Patrimônio Líquido (PL)
 *    sob o nome "Resultado do Período".
 * 3. Consolida as contas patrimoniais (ASSET, LIABILITY, EQUITY) via Bottom-Up recursivo.
 * 4. Pela matemática de partidas dobradas, a equação Ativo = Passivo + PL se fechará na vírgula.
 */
export function calculateBalanceSheet(
  rawData: BalanceSheetRawData,
  competence: string
): BalanceSheetReportData {
  const { accounts, lines, hasClosing, closingEntryNumber } = rawData

  // Define o último dia do mês de competência para o cabeçalho
  const date = new Date(competence + 'T00:00:00')
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const lastDay = new Date(year, month, 0).getDate()
  const dateOfCut = `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`

  // 1. Inicializa acumuladores de saldos para todas as contas analíticas/sintéticas
  const itemsMap = new Map<string, {
    acc: any
    debits: number
    credits: number
    signedAmount: number
  }>()

  accounts.forEach((acc) => {
    itemsMap.set(acc.id, {
      acc,
      debits: 0,
      credits: 0,
      signedAmount: 0
    })
  })

  // 2. Acumula os lançamentos históricos até o corte nas contas correspondentes
  lines.forEach((line) => {
    const item = itemsMap.get(line.account_id)
    if (item) {
      const amount = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
      if (line.debit_credit === 'DEBIT') {
        item.debits += amount
      } else {
        item.credits += amount
      }
    }
  })

  // 3. Calcula signedAmount (Débito - Crédito) das contas analíticas
  accounts.forEach((acc) => {
    const item = itemsMap.get(acc.id)!
    if (!acc.is_synthetic) {
      item.signedAmount = item.debits - item.credits
    }
  })

  // 4. Calcula o Resultado do Período acumulado (Receitas - Deduções - Custos - Despesas)
  let revenueTotal = 0
  let deductionsTotal = 0
  let costsTotal = 0
  let expensesTotal = 0

  accounts.forEach((acc) => {
    const item = itemsMap.get(acc.id)!
    if (!acc.is_synthetic) {
      const type = acc.account_type
      const signed = item.signedAmount

      if (type === 'REVENUE') {
        // Receitas: créditos maior que débitos, displayAmount = Créditos - Débitos = -signed
        revenueTotal += -signed
      } else if (type === 'REVENUE_DEDUCTION') {
        // Deduções: débitos maior que créditos
        deductionsTotal += signed
      } else if (type === 'COST') {
        // Custos: débitos maior que créditos
        costsTotal += signed
      } else if (type === 'EXPENSE') {
        // Despesas: débitos maior que créditos
        expensesTotal += signed
      }
    }
  })

  const netPeriodResult = revenueTotal - deductionsTotal - costsTotal - expensesTotal

  // 5. Consolidação Bottom-Up das contas patrimoniais (do maior nível para a raiz)
  // Ordena as contas patrimoniais por nível de forma decrescente
  const sortedAccounts = [...accounts]
    .filter((a) => ['ASSET', 'LIABILITY', 'EQUITY'].includes(a.account_type))
    .sort((a, b) => b.level - a.level)

  sortedAccounts.forEach((acc) => {
    const current = itemsMap.get(acc.id)!
    if (acc.parent_id && itemsMap.has(acc.parent_id)) {
      const parent = itemsMap.get(acc.parent_id)!
      parent.debits += current.debits
      parent.credits += current.credits
      parent.signedAmount += current.signedAmount
    }
  })

  // 6. Converte signedAmount flat contábil para o displayAmount patrimonial de apresentação
  const allPatrimonialItems: BalanceSheetItem[] = accounts
    .filter((a) => ['ASSET', 'LIABILITY', 'EQUITY'].includes(a.account_type))
    .map((acc) => {
      const item = itemsMap.get(acc.id)!
      
      let displayAmount = item.signedAmount
      if (acc.account_type === 'LIABILITY' || acc.account_type === 'EQUITY') {
        displayAmount = -item.signedAmount
      }

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        parent_id: acc.parent_id,
        account_type: acc.account_type,
        normal_balance: acc.normal_balance,
        level: acc.level,
        is_synthetic: acc.is_synthetic,
        is_active: acc.is_active,
        debits: item.debits,
        credits: item.credits,
        signedAmount: item.signedAmount,
        displayAmount
      }
    })

  // Filtra itens com movimentações para o balanço (limpeza visual de contas zeradas)
  const activeItems = allPatrimonialItems.filter((i) => {
    const hasMov = i.debits > 0.005 || i.credits > 0.005 || Math.abs(i.displayAmount) > 0.005
    return hasMov
  })

  // Divide nos blocos específicos
  const assets = activeItems.filter((i) => i.account_type === 'ASSET')
  const liabilities = activeItems.filter((i) => i.account_type === 'LIABILITY')
  const equity = activeItems.filter((i) => i.account_type === 'EQUITY')

  // Helper para somar totais analíticos de cada bloco
  const sumSectionAnalyticDisplay = (items: BalanceSheetItem[]) => {
    return items
      .filter((i) => !i.is_synthetic)
      .reduce((sum, i) => sum + i.displayAmount, 0)
  }

  const totalAssets = sumSectionAnalyticDisplay(assets)
  const totalLiabilities = sumSectionAnalyticDisplay(liabilities)
  const totalEquityBeforeResult = sumSectionAnalyticDisplay(equity)
  
  // Total consolidado do PL incluindo o resultado líquido cumulativo ainda não encerrado.
  // netPeriodResult é calculado a partir de TODAS as linhas de receita/despesa/custo desde o
  // início até a data de corte — para toda competência já encerrada isso já soma zero (o
  // próprio lançamento de encerramento zera a atividade daquela competência dentro desta
  // mesma soma). Por isso NUNCA condicionar essa soma a hasClosing da competência
  // selecionada: se tudo até aqui já foi encerrado, netPeriodResult já é 0 e somar não muda
  // nada; se alguma competência anterior ficou sem encerrar (ex.: Jan-Mar sem encerramento
  // com Dez já encerrado), o resultado dela precisa continuar aparecendo no PL — do
  // contrário o Ativo já reflete a movimentação, mas o PL não, e o Balanço não fecha.
  const totalEquity = totalEquityBeforeResult + netPeriodResult
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity
  
  const difference = totalAssets - totalLiabilitiesAndEquity
  const isBalanced = Math.abs(difference) < 0.01

  return {
    competence,
    dateOfCut,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquityBeforeResult,
    netPeriodResult, // Resultado líquido cumulativo ainda não encerrado (0 se tudo até a data de corte já foi encerrado)
    totalEquity,
    totalLiabilitiesAndEquity,
    difference,
    isBalanced,
    hasClosing,
    closingEntryNumber
  }
}
