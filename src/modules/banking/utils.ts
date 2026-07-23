import crypto from 'crypto'
import { BankStatementLineStatus } from './types'

export function formatCurrencyBRL(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (num === null || num === undefined || isNaN(num)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr + 'T00:00:00')
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

/**
 * Chave-base de deduplicação de linha de extrato (sem o desambiguador de ocorrência) —
 * exportada separadamente de computeLineHash só para permitir contar repetições da mesma
 * chave dentro de um lote de importação antes de calcular o hash final (ver
 * importBankStatementCsvAction).
 */
export function bankLineBaseKey(params: {
  companyId: string
  bankAccountId: string
  entryDate: string
  amount: number
  description: string
  documentNumber?: string
}): string {
  return [
    params.companyId,
    params.bankAccountId,
    params.entryDate,
    params.amount.toFixed(2),
    params.description.trim().toLowerCase(),
    (params.documentNumber || '').trim()
  ].join('|')
}

/**
 * Fórmula canônica de deduplicação de linha de extrato — MESMA fórmula usada em
 * db/seed/seed_demo_banking.sql (lá em SQL puro via md5(); aqui em Node via crypto).
 * Mudar esta fórmula sem atualizar o seed quebra a consistência de hash entre linhas
 * seedadas e linhas importadas pela aplicação.
 *
 * occurrenceIndex distingue duas transações REAIS e distintas que coincidem em data,
 * valor, descrição e número de documento (comum: duas tarifas ou dois PIX idênticos no
 * mesmo dia) — sem isso, a segunda ocorrência colide com a primeira e o INSERT em lote
 * inteiro falha com "duplicate key value violates ... bank_statement_lines_..._hash_key"
 * mesmo sem nenhuma reimportação de fato. Para occurrenceIndex 0 (o caso comum, primeira
 * ocorrência) o hash é IDÊNTICO ao de antes — só a partir da 2ª ocorrência ganha um sufixo,
 * preservando compatibilidade com hashes já gravados no banco e com o seed.
 */
export function computeLineHash(params: {
  companyId: string
  bankAccountId: string
  entryDate: string
  amount: number
  description: string
  documentNumber?: string
  occurrenceIndex?: number
}): string {
  const base = bankLineBaseKey(params)
  const normalized = params.occurrenceIndex ? `${base}|dup${params.occurrenceIndex}` : base

  return crypto.createHash('md5').update(normalized).digest('hex')
}

export const BANK_STATEMENT_LINE_STATUS_LABELS: Record<BankStatementLineStatus, string> = {
  PENDING: 'Pendente',
  CLASSIFIED: 'Classificada',
  RECONCILED: 'Conciliada',
  IGNORED: 'Ignorada',
  ERROR: 'Erro'
}
