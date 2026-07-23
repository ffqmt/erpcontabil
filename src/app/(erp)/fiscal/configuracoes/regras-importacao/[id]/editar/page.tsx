import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import { getImportClassificationRuleById } from '@/modules/fiscal/import-classification-rules/queries'
import { getPartnerOptions } from '@/modules/registrations/partners/queries'
import { getFiscalNatureOptions } from '@/modules/registrations/fiscal-natures/queries'
import { getItemOptions } from '@/modules/registrations/items/queries'
import { RuleForm } from '@/modules/fiscal/import-classification-rules/components/rule-form'
import { ListFilter } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EditImportClassificationRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()

  const [rule, partners, natures, items] = await Promise.all([
    getImportClassificationRuleById(id, context.companyId),
    getPartnerOptions(context.companyId, { activeOnly: true }),
    getFiscalNatureOptions(context.companyId, { activeOnly: true }),
    getItemOptions(context.companyId, { activeOnly: true })
  ])

  if (!rule) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <ListFilter className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Editar Regra de Importação XML</h2>
          <p className="text-sm text-gray-500">{rule.name}</p>
        </div>
      </div>

      <RuleForm
        rule={rule}
        partners={partners.map((p) => ({ id: p.id, name: p.name }))}
        natures={natures.map((n) => ({ id: n.id, code: n.code, name: n.name }))}
        items={items.map((it) => ({ id: it.id, description: it.description || '(sem descrição)' }))}
      />
    </div>
  )
}
