import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import { getBankAccountById } from '@/modules/registrations/bank-accounts/queries'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { BankAccountForm } from '@/modules/registrations/bank-accounts/components/bank-account-form'
import { Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EditBankAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()
  const [bankAccount, accounts] = await Promise.all([
    getBankAccountById(id, context.companyId),
    getAccounts(context.companyId)
  ])

  if (!bankAccount) {
    notFound()
  }

  const eligibleChartAccounts = accounts.filter((a) => a.accepts_entries && a.is_active)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Pencil className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Editar Conta Bancária</h2>
          <p className="text-sm text-gray-500">{bankAccount.bank_name || 'Conta Bancária'}</p>
        </div>
      </div>
      <BankAccountForm bankAccount={bankAccount} eligibleChartAccounts={eligibleChartAccounts} />
    </div>
  )
}
