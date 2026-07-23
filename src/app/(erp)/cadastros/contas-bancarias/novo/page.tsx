import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { BankAccountForm } from '@/modules/registrations/bank-accounts/components/bank-account-form'
import { Landmark } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NewBankAccountPage() {
  const context = await getCurrentContext()
  const accounts = await getAccounts(context.companyId)
  const eligibleChartAccounts = accounts.filter((a) => a.accepts_entries && a.is_active)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Landmark className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Nova Conta Bancária</h2>
          <p className="text-sm text-gray-500">Vincule a uma conta analítica do Plano de Contas.</p>
        </div>
      </div>
      <BankAccountForm eligibleChartAccounts={eligibleChartAccounts} />
    </div>
  )
}
