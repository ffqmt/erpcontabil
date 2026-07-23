import { AssetStatus } from './types'

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

export function formatCompetenceBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const parts = dateStr.split('-')
  if (parts.length < 2) return dateStr
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const idx = parseInt(parts[1], 10) - 1
  return `${months[idx] || parts[1]}/${parts[0]}`
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo (Depreciando)',
  FULLY_DEPRECIATED: 'Totalmente Depreciado',
  DISPOSED: 'Baixado',
  SOLD: 'Vendido',
  INACTIVE: 'Inativo'
}

/**
 * Calcula a depreciação linear mensal de um bem: (valor de aquisição - valor residual) /
 * vida útil em meses. Método travado em STRAIGHT_LINE nesta etapa (mesma restrição já
 * existente no schema — constraint chk_fixed_assets_mvp_method).
 */
export function calculateMonthlyDepreciation(acquisitionAmount: number, residualAmount: number, usefulLifeMonths: number): number {
  if (usefulLifeMonths <= 0) return 0
  const depreciableValue = acquisitionAmount - residualAmount
  return Math.round((depreciableValue / usefulLifeMonths) * 100) / 100
}
