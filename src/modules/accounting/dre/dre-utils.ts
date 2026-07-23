/**
 * Formata um valor numérico para moeda BRL (R$ 1.234,56).
 * Se o valor for negativo, pode ser exibido no padrão clássico contábil entre parênteses: (R$ 1.234,56).
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
  return `${months[idx] || parts[1]}/${parts[0]}`
}

export function formatPercentage(val: number): string {
  const num = val || 0
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + '%'
}

/**
 * Formata um valor numérico para a DRE em impressão (1.234,56 ou (1.234,56) para negativos, sem R$).
 */
export function formatDreValue(val: number): string {
  const num = val || 0
  if (Math.abs(num) < 0.001) return '0,00'
  const formatted = Math.abs(num).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return num < 0 ? `(${formatted})` : formatted
}


