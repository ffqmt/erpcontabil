import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import { getBankStatementLineById, listCostCentersForClassification, searchJournalEntryLinesForLinking } from '@/modules/banking/queries'
import { findMatchingReconciliationRule } from '@/modules/banking/reconciliation-rules/queries'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { getPartners } from '@/modules/registrations/partners/queries'
import { getBankAccounts } from '@/modules/registrations/bank-accounts/queries'
import { BankStatementClassificationForm } from '@/modules/banking/components/bank-statement-classification-form'
import { Tag } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ClassifyBankStatementLinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()

  const line = await getBankStatementLineById(id, context.companyId)
  if (!line) {
    notFound()
  }

  const [chartAccounts, partners, costCenters, bankAccounts] = await Promise.all([
    getAccounts(context.companyId),
    getPartners(context.companyId),
    listCostCentersForClassification(context.companyId),
    getBankAccounts(context.companyId)
  ])

  const activePartners = partners.filter((p) => p.active)
  const bankAccount = bankAccounts.find((b) => b.id === line.bank_account_id)

  let candidates: Awaited<ReturnType<typeof searchJournalEntryLinesForLinking>> = []
  if (bankAccount?.chart_account_id && line.status !== 'RECONCILED') {
    candidates = await searchJournalEntryLinesForLinking({
      companyId: context.companyId,
      bankChartAccountId: bankAccount.chart_account_id,
      amount: typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount,
      entryDate: line.entry_date
    })
  }

  const matchedRule = line.status === 'PENDING'
    ? await findMatchingReconciliationRule(context.companyId, line.description, typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount)
    : null

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Tag className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Classificar Linha de Extrato</h2>
          <p className="text-sm text-gray-500">{line.description}</p>
        </div>
      </div>
      <BankStatementClassificationForm
        line={line}
        chartAccounts={chartAccounts}
        partners={activePartners}
        costCenters={costCenters}
        candidates={candidates as any}
        matchedRule={matchedRule}
      />
    </div>
  )
}
