import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { getFiscalNatures } from '@/modules/registrations/fiscal-natures/queries'
import { getPartners } from '@/modules/registrations/partners/queries'
import { RuleForm } from '@/modules/fiscal/accounting-rules/components/rule-form'
import { ScrollText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NewFiscalAccountingRulePage() {
  const context = await getCurrentContext()

  const [chartAccounts, fiscalNatures, partners] = await Promise.all([
    getAccounts(context.companyId),
    getFiscalNatures(context.companyId),
    getPartners(context.companyId)
  ])

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <ScrollText className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Nova Regra Contábil Fiscal</h2>
          <p className="text-sm text-gray-500">Configure as condições e as contas de débito/crédito sugeridas.</p>
        </div>
      </div>
      <RuleForm chartAccounts={chartAccounts} fiscalNatures={fiscalNatures.filter((n) => n.is_active)} partners={partners.filter((p) => p.active)} />
    </div>
  )
}
