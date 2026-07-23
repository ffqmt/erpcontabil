// Apuração CLOSED/CANCELLED não aceita mais edição por actions comuns (recálculo, linhas
// manuais, saldo anterior, ajustes de multa/juros) — mesmo conjunto de status "editável" já
// usado por adjustTaxAssessmentAction desde a Etapa 20, agora compartilhado.
export const EDITABLE_ASSESSMENT_STATUSES = ['DRAFT', 'CALCULATED', 'REVIEWED']

export function formatCurrencyBRL(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (num === null || num === undefined || isNaN(num)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

export function formatCompetenceBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const parts = dateStr.split('-')
  if (parts.length < 2) return dateStr
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const idx = parseInt(parts[1], 10) - 1
  return `${months[idx] || parts[1]}/${parts[0]}`
}
