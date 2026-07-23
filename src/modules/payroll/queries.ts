import { getClient } from '@/lib/supabase/server'
import { PayrollDashboardData, PayrollEsocialEvent } from './types'

async function getDb() {
  return getClient()
}

export interface PayrollEventFilters {
  competence?: string
  eventType?: string
  accountingStatus?: string
  text?: string
}

function competenceFirstDay(competence: string | undefined): string | null {
  if (!competence) return null
  const match = competence.match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-01` : null
}

export async function getPayrollDashboard(companyId: string, competence: string): Promise<PayrollDashboardData> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')
  const db = await getDb()
  const competenceStart = competenceFirstDay(competence) || `${competence.substring(0, 7)}-01`

  const { data, error } = await db
    .from('payroll_esocial_events')
    .select('gross_amount, deductions_amount, net_amount, accounting_status')
    .eq('company_id', companyId)
    .eq('period_competence', competenceStart)

  if (error) throw new Error(error.message || 'Falha ao buscar eventos de folha.')

  const rows = data || []
  return rows.reduce<PayrollDashboardData>((acc, row) => {
    acc.eventsThisCompetence += 1
    acc.grossAmount += Number(row.gross_amount || 0)
    acc.deductionAmount += Number(row.deductions_amount || 0)
    acc.netAmount += Number(row.net_amount || 0)
    if (row.accounting_status !== 'ACCOUNTED') acc.notAccountedCount += 1
    return acc
  }, {
    eventsThisCompetence: 0,
    notAccountedCount: 0,
    grossAmount: 0,
    netAmount: 0,
    deductionAmount: 0
  })
}

export async function listPayrollEsocialEvents(companyId: string, filters: PayrollEventFilters = {}): Promise<PayrollEsocialEvent[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')
  const db = await getDb()
  let query = db
    .from('payroll_esocial_events')
    .select('*, import:payroll_esocial_imports(file_name, created_at), items:payroll_esocial_event_items(*)')
    .eq('company_id', companyId)

  const competenceStart = competenceFirstDay(filters.competence)
  if (competenceStart) query = query.eq('period_competence', competenceStart)
  if (filters.eventType) query = query.eq('event_type', filters.eventType)
  if (filters.accountingStatus) query = query.eq('accounting_status', filters.accountingStatus)
  if (filters.text) {
    const text = filters.text.replace(/[%,]/g, '')
    query = query.or(`event_id.ilike.%${text}%,worker_cpf.ilike.%${text}%,worker_name.ilike.%${text}%`)
  }

  const { data, error } = await query
    .order('period_competence', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message || 'Falha ao buscar eventos do eSocial.')

  return (data || []) as unknown as PayrollEsocialEvent[]
}
