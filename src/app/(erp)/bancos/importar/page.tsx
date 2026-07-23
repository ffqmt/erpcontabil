import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getBankAccounts } from '@/modules/registrations/bank-accounts/queries'
import { BankStatementImportForm } from '@/modules/banking/components/bank-statement-import-form'
import { Upload } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ImportBankStatementPage() {
  const context = await getCurrentContext()
  const bankAccounts = await getBankAccounts(context.companyId)
  const activeBankAccounts = bankAccounts.filter((b) => b.active)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Upload className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Importar Extrato Bancário</h2>
          <p className="text-sm text-gray-500">Cole ou envie um extrato em CSV para classificação.</p>
        </div>
      </div>
      <BankStatementImportForm bankAccounts={activeBankAccounts} />
    </div>
  )
}
