import { AccountType } from '../accounts/types'

/**
 * Formata moeda BRL (R$ 1.234,56).
 */
export function formatCurrencyBRL(val: number): string {
  if (isNaN(val) || Math.abs(val) < 0.001) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * Formata número BRL sem símbolo de moeda (1.234,56).
 */
export function formatNumberBRL(val: number): string {
  if (isNaN(val) || Math.abs(val) < 0.001) return '0,00'
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}


/**
 * Converte data de competência ISO YYYY-MM-DD para "Janeiro de YYYY"
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
 * Retorna as cores de estilo do badge D/C.
 */
export function getNatureBadgeStyle(nature: 'D' | 'C'): string {
  if (nature === 'D') {
    return 'bg-cyan-50 text-cyan-700 border border-cyan-150'
  }
  return 'bg-amber-50 text-amber-700 border border-amber-150'
}

/**
 * Retorna o rótulo legível do tipo de conta.
 */
export function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'ASSET':
      return 'Ativo'
    case 'LIABILITY':
      return 'Passivo'
    case 'EQUITY':
      return 'Patrimônio Líquido'
    case 'REVENUE':
      return 'Receita'
    case 'REVENUE_DEDUCTION':
      return 'Dedução'
    case 'COST':
      return 'Custo'
    case 'EXPENSE':
      return 'Despesa'
    default:
      return type
  }
}
