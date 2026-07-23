import React from 'react'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { getPayrollDashboard, listPayrollEsocialEvents } from '@/modules/payroll/queries'
import { PayrollDashboardCards } from '@/modules/payroll/components/payroll-dashboard-cards'
import { PayrollEventList } from '@/modules/payroll/components/payroll-event-list'
import { AlertCircle, FileUp, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ competence?: string; eventType?: string; accountingStatus?: string; text?: string }>
}

export default async function PayrollPage({ searchParams }: PageProps) {
  const params = await searchParams
  const context = await getCurrentContext()

  let errorMsg: string | null = null
  let dashboard: Awaited<ReturnType<typeof getPayrollDashboard>> = {
    eventsThisCompetence: 0,
    notAccountedCount: 0,
    grossAmount: 0,
    netAmount: 0,
    deductionAmount: 0
  }
  let events: Awaited<ReturnType<typeof listPayrollEsocialEvents>> = []
  let accounts: Awaited<ReturnType<typeof getAccounts>> = []

  try {
    const dashboardCompetence = params.competence || context.competence
    ;[dashboard, events, accounts] = await Promise.all([
      getPayrollDashboard(context.companyId, dashboardCompetence),
      listPayrollEsocialEvents(context.companyId, params),
      getAccounts(context.companyId)
    ])
  } catch (error: unknown) {
    errorMsg = error instanceof Error ? error.message : 'Falha ao carregar folha de pagamento.'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Folha de Pagamento</h2>
            <p className="text-sm text-gray-500">Eventos do eSocial importados para conferência e contabilização.</p>
          </div>
        </div>
        <Link href="/folha/importar-esocial" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all">
          <FileUp className="w-4 h-4" />
          Importar eSocial
        </Link>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : (
        <>
          <PayrollDashboardCards data={dashboard} />
          <PayrollEventList events={events} accounts={accounts} />
        </>
      )}
    </div>
  )
}
