import { ObligationWorkflowStatus } from './types'

export function formatCurrencyBRL(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (num === null || num === undefined || isNaN(num)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr.substring(0, 10) + 'T00:00:00')
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export const OBLIGATION_STATUS_LABELS: Record<ObligationWorkflowStatus, string> = {
  OPEN: 'Aberta',
  GENERATED: 'Gerada',
  PAID: 'Paga',
  DELIVERED: 'Entregue',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada'
}

export function isDueSoon(dueDate: string, days = 7): boolean {
  const due = new Date(dueDate.substring(0, 10) + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= days
}

// Nenhuma action transiciona o status armazenado para 'OVERDUE' (não há job/cron nesta
// etapa — Central de Pendências fica para etapa futura). "Vencida" é sempre CALCULADA em
// tempo de leitura a partir de due_date, para status ainda abertos, em vez de depender de
// um valor de status que nunca é escrito pela aplicação fora do seed de demonstração.
export function isObligationOverdue(status: string, dueDate: string | null | undefined): boolean {
  if (status === 'OVERDUE') return true
  if (status !== 'OPEN' && status !== 'GENERATED') return false
  if (!dueDate) return false
  const due = new Date(dueDate.substring(0, 10) + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return due.getTime() < now.getTime()
}
