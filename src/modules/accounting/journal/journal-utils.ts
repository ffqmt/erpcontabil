import { JournalOrigin, JournalStatus } from './types'

/**
 * Formata um valor numérico ou string numérica para moeda BRL (R$ 1.234,56).
 */
export function formatCurrencyBRL(val: number | string): string {
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return 'R$ 0,00'
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * Converte data do formato YYYY-MM-DD para DD/MM/YYYY.
 */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

/**
 * Converte competência YYYY-MM-DD para "Janeiro/YYYY"
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
 * Retorna o rótulo humanizado para a origem do lançamento.
 */
export function getOriginLabel(origin: JournalOrigin | string): string {
  switch (origin) {
    case 'MANUAL':
      return 'Manual'
    case 'OPENING':
      return 'Abertura'
    case 'FISCAL_DOCUMENT':
      return 'Doc. Fiscal'
    case 'FISCAL_ASSESSMENT':
      return 'Apuração Fiscal'
    case 'PAYROLL_SUMMARY':
      return 'Resumo Folha'
    case 'PAYROLL_PAYMENT':
      return 'Pgto Folha'
    case 'BANK_STATEMENT':
      return 'Extrato'
    case 'ASSET_ACQUISITION':
      return 'Compra Ativo'
    case 'ASSET_DEPRECIATION':
      return 'Depreciação'
    case 'ASSET_DISPOSAL':
      return 'Baixa Ativo'
    case 'IRPJ_CSLL':
      return 'IRPJ/CSLL'
    case 'RESULT_CLOSING':
      return 'Encerr. Exercício'
    case 'REVERSAL':
      return 'Estorno/Reversão'
    default:
      return origin || 'Desconhecido'
  }
}

/**
 * Retorna o rótulo humanizado para o status do lançamento.
 */
export function getJournalStatusLabel(status: JournalStatus | string): string {
  switch (status) {
    case 'DRAFT':
      return 'Rascunho'
    case 'POSTED':
      return 'Publicado'
    case 'REVERSED':
      return 'Estornado'
    case 'CANCELLED':
      return 'Cancelado'
    case 'PENDING_CLASSIFICATION':
      return 'Pendente'
    default:
      return status || 'Desconhecido'
  }
}
