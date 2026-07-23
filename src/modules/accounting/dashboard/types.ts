import { DreReportData } from '../dre/types'
import { BalanceSheetReportData } from '../balance-sheet/types'
import { JournalEntry } from '../journal/types'

export interface AccountingDashboardData {
  competence: string
  periodStatus: 'OPEN' | 'IN_REVIEW' | 'CLOSED' | 'REOPENED'
  hasClosing: boolean
  closingEntryNumber?: string | number
  equityResultAccount: {
    id: string
    code: string
    name: string
  } | null
  draftsCount: number
  postedCount: number
  reversedCount: number
  totalEntries: number
  recentEntries: JournalEntry[]
  dre: DreReportData
  balanceSheet: BalanceSheetReportData
  alerts: string[]
}
