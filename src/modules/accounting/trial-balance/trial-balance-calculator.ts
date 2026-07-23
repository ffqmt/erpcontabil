import { TrialBalanceRawData } from './queries'
import { TrialBalanceItem } from './types'

/**
 * Calcula o balancete contábil de verificação agregando movimentações históricas
 * e periódicas nas contas contábeis analíticas e consolidando a hierarquia
 * sintética de baixo para cima (da folha para a raiz).
 * 
 * Regra Universal Contábil (Flat Assinado):
 * - Valores de Débito incrementam o saldo (+).
 * - Valores de Crédito decrementam o saldo (-).
 * - Saldo Flat final positivo = Natureza Devedora (D).
 * - Saldo Flat final negativo = Natureza Credora (C).
 */
export function calculateTrialBalance(rawData: TrialBalanceRawData): TrialBalanceItem[] {
  const { accounts, previousLines, periodLines } = rawData

  // 1. Inicializa o mapa de itens do balancete
  const itemsMap = new Map<string, {
    acc: any
    initialFlat: number
    periodDebits: number
    periodCredits: number
    finalFlat: number
  }>()

  accounts.forEach((acc) => {
    itemsMap.set(acc.id, {
      acc,
      initialFlat: 0,
      periodDebits: 0,
      periodCredits: 0,
      finalFlat: 0
    })
  })

  // 2. Acumula os lançamentos anteriores nas contas analíticas (Saldo Anterior)
  previousLines.forEach((line) => {
    const item = itemsMap.get(line.account_id)
    if (item) {
      const amount = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
      if (line.debit_credit === 'DEBIT') {
        item.initialFlat += amount
      } else {
        item.initialFlat -= amount
      }
    }
  })

  // 3. Acumula os lançamentos da competência nas contas analíticas (Movimento Período)
  periodLines.forEach((line) => {
    const item = itemsMap.get(line.account_id)
    if (item) {
      const amount = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
      if (line.debit_credit === 'DEBIT') {
        item.periodDebits += amount
      } else {
        item.periodCredits += amount
      }
    }
  })

  // 4. Calcula o saldo final flat das contas analíticas
  accounts.forEach((acc) => {
    const item = itemsMap.get(acc.id)!
    if (!acc.is_synthetic) {
      item.finalFlat = item.initialFlat + item.periodDebits - item.periodCredits
    }
  })

  // 5. Consolidação Hierárquica de Baixo para Cima (Bottom-Up)
  // Ordena as contas por nível de forma decrescente para processar do nível mais profundo para a raiz
  const sortedAccounts = [...accounts].sort((a, b) => b.level - a.level)

  sortedAccounts.forEach((acc) => {
    const current = itemsMap.get(acc.id)!
    
    // Se a conta possui um pai, adiciona os saldos da conta atual (inclusive acumulados) no pai contábil
    if (acc.parent_id && itemsMap.has(acc.parent_id)) {
      const parent = itemsMap.get(acc.parent_id)!
      parent.initialFlat += current.initialFlat
      parent.periodDebits += current.periodDebits
      parent.periodCredits += current.periodCredits
      parent.finalFlat += current.finalFlat
    }
  })

  // 6. Converte a representação Flat para a visualização D/C real de balancete
  const result: TrialBalanceItem[] = accounts.map((acc) => {
    const item = itemsMap.get(acc.id)!
    
    // Converte Saldo Anterior
    const initialVal = Math.abs(item.initialFlat)
    let initialNature: 'D' | 'C' = acc.normal_balance === 'DEBIT' ? 'D' : 'C'
    if (item.initialFlat > 0.005) {
      initialNature = 'D'
    } else if (item.initialFlat < -0.005) {
      initialNature = 'C'
    }

    // Converte Saldo Final
    const finalVal = Math.abs(item.finalFlat)
    let finalNature: 'D' | 'C' = acc.normal_balance === 'DEBIT' ? 'D' : 'C'
    if (item.finalFlat > 0.005) {
      finalNature = 'D'
    } else if (item.finalFlat < -0.005) {
      finalNature = 'C'
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
      accepts_entries: acc.accepts_entries,
      
      initialBalance: initialVal,
      initialNature,
      periodDebits: item.periodDebits,
      periodCredits: item.periodCredits,
      finalBalance: finalVal,
      finalNature
    }
  })

  return result
}
