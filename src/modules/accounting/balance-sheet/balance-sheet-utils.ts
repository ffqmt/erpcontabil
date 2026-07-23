/**
 * Formata um valor numérico para moeda BRL (R$ 1.234,56).
 * Suporta formatação entre parênteses para valores negativos (representando saldo devedor em Passivo/PL ou credor em Ativos).
 */
export function formatCurrencyBRL(val: number, showParenthesesForNegative = false): string {
  const num = val || 0
  if (Math.abs(num) < 0.001) return 'R$ 0,00'
  
  if (num < 0 && showParenthesesForNegative) {
    return `(${Math.abs(num).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })})`
  }

  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * Converte data de competência ISO YYYY-MM-DD para "Janeiro/YYYY"
 */
export function formatCompetenceBR(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 2) return dateStr
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  const idx = parseInt(parts[1], 10) - 1
  return `${months[idx] || parts[1]} de ${parts[0]}`
}

/**
 * Formata valor do Balanço Patrimonial com sufixo D/C (1.234,56D ou 1.234,56C).
 */
export function formatBalanceValue(val: number, signedAmount: number, accountType: string): string {
  const absVal = Math.abs(val)
  if (absVal < 0.001) return '0,00'
  const formatted = absVal.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  
  let nature = 'D'
  if (signedAmount > 0.005) {
    nature = 'D'
  } else if (signedAmount < -0.005) {
    nature = 'C'
  } else {
    nature = accountType === 'ASSET' ? 'D' : 'C'
  }
  
  return `${formatted}${nature}`
}

