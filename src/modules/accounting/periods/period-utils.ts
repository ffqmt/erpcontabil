/**
 * Formata moeda BRL (R$ 1.234,56).
 */
export function formatCurrencyBRL(val: number): string {
  const num = val || 0
  if (Math.abs(num) < 0.001) return 'R$ 0,00'
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

/**
 * Converte data do formato ISO YYYY-MM-DD para DD/MM/YYYY.
 */
export function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return '-'
  const cleanStr = dateStr.split('T')[0]
  const parts = cleanStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}
