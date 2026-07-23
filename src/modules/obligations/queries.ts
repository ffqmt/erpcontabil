import { getClient } from '@/lib/supabase/server'
import { Obligation, ObligationsDashboardData } from './types'
import { isDueSoon, isObligationOverdue } from './utils'

async function getDb() {
  return getClient()
}

export async function getObligationsDashboard(companyId: string): Promise<ObligationsDashboardData> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')

  const db = await getDb()
  const { data, error } = await db.from('obligations').select('status, amount, due_date, paid_at, delivered_at').eq('company_id', companyId)
  if (error) throw new Error(error.message || 'Falha ao buscar obrigações.')

  const rows = data || []
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  let openCount = 0
  let overdueCount = 0
  let dueSoonCount = 0
  let paidOrDeliveredThisMonthCount = 0
  let openAmountTotal = 0

  rows.forEach((o: any) => {
    if (o.status === 'OPEN' || o.status === 'GENERATED') {
      openCount++
      openAmountTotal += Number(o.amount) || 0
      if (isObligationOverdue(o.status, o.due_date)) overdueCount++
      else if (isDueSoon(o.due_date)) dueSoonCount++
    } else if (o.status === 'OVERDUE') {
      overdueCount++
    }
    const eventDate = o.paid_at || o.delivered_at
    if (eventDate && new Date(eventDate) >= monthStart) paidOrDeliveredThisMonthCount++
  })

  return { openCount, overdueCount, dueSoonCount, paidOrDeliveredThisMonthCount, openAmountTotal }
}

export async function listObligations(companyId: string, filters: { status?: string; obligationType?: string } = {}): Promise<Obligation[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')

  const db = await getDb()
  let query = db.from('obligations').select('*, payment_journal_entry:journal_entries!obligations_payment_journal_entry_id_fkey(number, status)').eq('company_id', companyId)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.obligationType) query = query.eq('obligation_type', filters.obligationType)

  const { data, error } = await query.order('due_date', { ascending: true })
  if (error) throw new Error(error.message || 'Falha ao buscar obrigações.')

  return (data || []) as unknown as Obligation[]
}

export async function getObligationById(id: string, companyId: string): Promise<Obligation | null> {
  if (!id || !companyId) throw new Error('ID de obrigação e empresa ativa são obrigatórios.')

  const db = await getDb()
  const { data, error } = await db
    .from('obligations')
    .select('*, payment_journal_entry:journal_entries!obligations_payment_journal_entry_id_fkey(number, status)')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Falha ao buscar a obrigação.')
  return data as unknown as Obligation | null
}
