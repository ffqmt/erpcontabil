import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { listBankStatementLines } from '@/modules/banking/queries'
import { getBankAccounts } from '@/modules/registrations/bank-accounts/queries'
import { BankStatementLineList } from '@/modules/banking/components/bank-statement-line-list'
import { BankStatementLineStatus } from '@/modules/banking/types'
import { ListChecks, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    bankAccountId?: string
    status?: string
    dateFrom?: string
    dateTo?: string
    text?: string
  }>
}

export default async function BankReconciliationPage({ searchParams }: PageProps) {
  const params = await searchParams
  const context = await getCurrentContext()

  let errorMsg: string | null = null
  let lines: Awaited<ReturnType<typeof listBankStatementLines>> = []
  let bankAccounts: Awaited<ReturnType<typeof getBankAccounts>> = []

  try {
    ;[lines, bankAccounts] = await Promise.all([
      listBankStatementLines(context.companyId, {
        bankAccountId: params.bankAccountId,
        status: params.status as BankStatementLineStatus | undefined,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        text: params.text
      }),
      getBankAccounts(context.companyId)
    ])
  } catch (error: any) {
    errorMsg = error.message || 'Falha ao carregar linhas de extrato.'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <ListChecks className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Conciliação Bancária</h2>
          <p className="text-sm text-gray-500">Classifique e concilie as linhas de extrato importadas.</p>
        </div>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : (
        <BankStatementLineList lines={lines} bankAccounts={bankAccounts} />
      )}
    </div>
  )
}
