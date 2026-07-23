import React from 'react'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { listPayrollEsocialEvents } from '@/modules/payroll/queries'
import { EsocialImportForm } from '@/modules/payroll/components/esocial-import-form'
import { PayrollEventList } from '@/modules/payroll/components/payroll-event-list'
import { ArrowLeft, FileUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ImportEsocialPage() {
  const context = await getCurrentContext()
  const [recentEvents, accounts] = await Promise.all([
    listPayrollEsocialEvents(context.companyId),
    getAccounts(context.companyId)
  ])

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <FileUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Importar XML do eSocial</h2>
            <p className="text-sm text-gray-500">Importe eventos de folha para preparar a contabilização.</p>
          </div>
        </div>
        <Link href="/folha" className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 font-semibold text-sm rounded-lg transition-all">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
      </div>

      <EsocialImportForm />

      <div className="pt-2">
        <h3 className="text-base font-bold text-gray-800 mb-3">Eventos importados</h3>
        <PayrollEventList events={recentEvents.slice(0, 10)} accounts={accounts} />
      </div>
    </div>
  )
}
