import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { getFiscalNatures } from '@/modules/registrations/fiscal-natures/queries'
import { getPartners } from '@/modules/registrations/partners/queries'
import { getFiscalAccountingRuleById } from '@/modules/fiscal/accounting-rules/queries'
import { RuleForm } from '@/modules/fiscal/accounting-rules/components/rule-form'
import { ScrollText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EditFiscalAccountingRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()

  const rule = await getFiscalAccountingRuleById(id, context.companyId)
  if (!rule) notFound()

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
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Editar Regra Contábil Fiscal</h2>
          <p className="text-sm text-gray-500">{rule.name}</p>
        </div>
      </div>
      <RuleForm rule={rule} chartAccounts={chartAccounts} fiscalNatures={fiscalNatures.filter((n) => n.is_active)} partners={partners.filter((p) => p.active)} />
    </div>
  )
}
