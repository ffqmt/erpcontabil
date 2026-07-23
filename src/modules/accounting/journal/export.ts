import { JournalEntry } from './types'
import { formatCsvCurrency } from '@/lib/csv/export-csv'

export const JOURNAL_CSV_HEADERS = [
  { key: 'number', label: 'Número' },
  { key: 'entryDate', label: 'Data' },
  { key: 'competence', label: 'Competência' },
  { key: 'status', label: 'Status' },
  { key: 'origin', label: 'Origem' },
  { key: 'description', label: 'Histórico' },
  { key: 'accountCode', label: 'Código da Conta' },
  { key: 'accountName', label: 'Nome da Conta' },
  { key: 'debit', label: 'Débito' },
  { key: 'credit', label: 'Crédito' },
  { key: 'memo', label: 'Memo Linha' },
  { key: 'costCenter', label: 'Centro de Custo' }
]

/**
 * Converte a lista de Lançamentos Contábeis para uma estrutura plana de linhas de CSV,
 * onde cada linha contábil (perna) vira uma linha no CSV.
 */
export function mapJournalToCsvRows(entries: JournalEntry[]): Record<string, any>[] {
  const rows: Record<string, any>[] = []

  entries.forEach((entry) => {
    const entryDateBR = entry.entry_date.split('-').reverse().join('/') // DD/MM/YYYY
    
    // Competência em formato MM/YYYY
    const compParts = entry.competence.split('-')
    const competenceBR = `${compParts[1]}/${compParts[0]}`

    entry.lines.forEach((line) => {
      const amountVal = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
      const isDebit = line.debit_credit === 'DEBIT'
      
      const debitStr = isDebit ? formatCsvCurrency(amountVal) : ''
      const creditStr = !isDebit ? formatCsvCurrency(amountVal) : ''

      rows.push({
        number: entry.number || 'Rascunho',
        entryDate: entryDateBR,
        competence: competenceBR,
        status: entry.status,
        origin: entry.origin,
        description: entry.description,
        accountCode: line.account?.code || '',
        accountName: line.account?.name || '',
        debit: debitStr,
        credit: creditStr,
        memo: line.memo || '',
        costCenter: line.cost_center?.name || ''
      })
    })
  })

  return rows
}
