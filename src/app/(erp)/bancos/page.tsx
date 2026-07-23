import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getBankingDashboard } from '@/modules/banking/queries'
import { BankingDashboardCards } from '@/modules/banking/components/banking-dashboard-cards'
import { Landmark, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BankingDashboardPage() {
  const context = await getCurrentContext()

  let errorMsg: string | null = null
  let data: Awaited<ReturnType<typeof getBankingDashboard>> | null = null

  try {
    data = await getBankingDashboard(context.companyId)
  } catch (error: any) {
    errorMsg = error.message || 'Falha ao carregar o painel bancário.'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Landmark className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Bancos e Conciliação</h2>
          <p className="text-sm text-gray-500">Importe extratos, classifique movimentações e concilie com o livro diário.</p>
        </div>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : (
        <BankingDashboardCards data={data!} />
      )}
    </div>
  )
}
