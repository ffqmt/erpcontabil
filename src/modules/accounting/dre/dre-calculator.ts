import { DreRawData } from './queries'
import { DreReportData, DreItem, DreSectionData } from './types'

/**
 * Calcula a Demonstração do Resultado do Exercício (DRE) a partir dos dados brutos:
 * 1. Inicializa os acumuladores nas contas analíticas.
 * 2. Propaga os saldos para cima na árvore contábil de forma recursiva (Bottom-Up).
 * 3. Inverte o sinal dos saldos de receita (displayAmount = créditos - débitos).
 * 4. Mapeia as contas para as seções correspondentes (Receitas, Deduções, Custos, Despesas, IRPJ/CSLL).
 * 5. Calcula os subtotais e margem líquida.
 */
export function calculateDre(rawData: DreRawData, competence: string): DreReportData {
  const { accounts, lines } = rawData

  // 1. Inicializa o mapa de itens calculados
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

  // 2. Acumula os lançamentos do período nas contas analíticas
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

  // 3. Calcula o signedAmount (Débito - Crédito) das analíticas
  accounts.forEach((acc) => {
    const item = itemsMap.get(acc.id)!
    if (!acc.is_synthetic) {
      item.signedAmount = item.debits - item.credits
    }
  })

  // 4. Consolidação Bottom-Up recursiva (do maior nível para a raiz)
  const sortedAccounts = [...accounts].sort((a, b) => b.level - a.level)

  sortedAccounts.forEach((acc) => {
    const current = itemsMap.get(acc.id)!
    if (acc.parent_id && itemsMap.has(acc.parent_id)) {
      const parent = itemsMap.get(acc.parent_id)!
      parent.debits += current.debits
      parent.credits += current.credits
      parent.signedAmount += current.signedAmount
    }
  })

  // 5. Mapeia e define a displayAmount de cada item
  const allItems: DreItem[] = accounts.map((acc) => {
    const item = itemsMap.get(acc.id)!
    
    // Inversão de sinal para receitas (Créditos - Débitos = positivo)
    let displayAmount = item.signedAmount
    if (acc.account_type === 'REVENUE') {
      displayAmount = -item.signedAmount
    }

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      parent_id: acc.parent_id,
      account_type: acc.account_type,
      level: acc.level,
      is_synthetic: acc.is_synthetic,
      debits: item.debits,
      credits: item.credits,
      signedAmount: item.signedAmount,
      displayAmount
    }
  })

  // 6. Divide os itens nas seções específicas da DRE
  const revenueItems: DreItem[] = []
  const deductionItems: DreItem[] = []
  const costItems: DreItem[] = []
  const expenseItems: DreItem[] = []
  const taxItems: DreItem[] = []

  allItems.forEach((item) => {
    // Filtro para ocultar contas sem movimentação no período para deixar o relatório enxuto
    const hasMov = item.debits > 0.005 || item.credits > 0.005 || Math.abs(item.displayAmount) > 0.005
    if (!hasMov) return

    // Verifica se é IRPJ/CSLL (código inicia com 8 no plano)
    const isTaxAccount = item.code.startsWith('8')

    if (item.account_type === 'REVENUE') {
      revenueItems.push(item)
    } else if (item.account_type === 'REVENUE_DEDUCTION') {
      deductionItems.push(item)
    } else if (item.account_type === 'COST') {
      costItems.push(item)
    } else if (isTaxAccount) {
      taxItems.push(item)
    } else if (item.account_type === 'EXPENSE') {
      expenseItems.push(item)
    }
  })

  // Helper para somar os totais das analíticas de cada seção
  const sumSectionAnalytic = (items: DreItem[]) => {
    return items
      .filter((i) => !i.is_synthetic)
      .reduce((sum, i) => sum + i.displayAmount, 0)
  }

  const grossRevenue = sumSectionAnalytic(revenueItems)
  const deductionsTotal = sumSectionAnalytic(deductionItems)
  const netRevenue = grossRevenue - deductionsTotal
  
  const costsTotal = sumSectionAnalytic(costItems)
  const grossProfit = netRevenue - costsTotal

  const expensesTotal = sumSectionAnalytic(expenseItems)
  const operatingProfit = grossProfit - expensesTotal

  const taxTotal = sumSectionAnalytic(taxItems)
  const netProfit = operatingProfit - taxTotal

  const netMargin = netRevenue > 0.005 ? (netProfit / netRevenue) * 100 : 0

  return {
    competence,
    sections: {
      revenue: { title: 'Receita Operacional Bruta', type: 'REVENUE', items: revenueItems, total: grossRevenue },
      deductions: { title: 'Deduções da Receita', type: 'REVENUE_DEDUCTION', items: deductionItems, total: deductionsTotal },
      costs: { title: 'Custos Operacionais', type: 'COST', items: costItems, total: costsTotal },
      expenses: { title: 'Despesas Operacionais', type: 'EXPENSE', items: expenseItems, total: expensesTotal },
      tax: { title: 'Provisões Tributárias (IRPJ / CSLL)', type: 'IRPJ_CSLL', items: taxItems, total: taxTotal }
    },
    grossRevenue,
    deductionsTotal,
    netRevenue,
    costsTotal,
    grossProfit,
    expensesTotal,
    operatingProfit,
    taxTotal,
    netProfit,
    netMargin
  }
}
