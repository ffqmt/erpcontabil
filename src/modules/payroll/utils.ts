import { PayrollAccountingStatus } from './types'

export function formatCurrencyBRL(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (num === null || num === undefined || Number.isNaN(num)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export function formatCompetenceBR(competence: string | null | undefined): string {
  if (!competence) return '—'
  const [year, month] = competence.substring(0, 7).split('-')
  if (!year || !month) return competence
  return `${month}/${year}`
}

export const PAYROLL_ACCOUNTING_STATUS_LABELS: Record<PayrollAccountingStatus, string> = {
  NOT_ACCOUNTED: 'Não Contabilizado',
  ACCOUNTED: 'Contabilizado',
  ACCOUNTING_ERROR: 'Erro na Contabilização'
}

export const ESOCIAL_EVENT_LABELS: Record<string, string> = {
  'S-1200': 'Remuneração',
  'S-1202': 'Remuneração RPPS',
  'S-1207': 'Benefícios',
  'S-1210': 'Pagamentos',
  'S-2299': 'Desligamento',
  'S-2399': 'Término TSV',
  'S-5001': 'Bases e Contribuições',
  'S-5002': 'IRRF por trabalhador',
  'S-5011': 'Contribuições Sociais',
  ESOCIAL: 'Evento eSocial'
}
