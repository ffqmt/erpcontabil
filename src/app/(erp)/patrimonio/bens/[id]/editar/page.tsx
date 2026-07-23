import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import { getFixedAssetById, listAssetCategories } from '@/modules/assets/queries'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { getPartners } from '@/modules/registrations/partners/queries'
import { listCostCentersForClassification } from '@/modules/banking/queries'
import { FixedAssetForm } from '@/modules/assets/components/fixed-asset-form'
import { Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EditFixedAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()

  const asset = await getFixedAssetById(id, context.companyId)
  if (!asset) notFound()

  const [categories, chartAccounts, partners, costCenters] = await Promise.all([
    listAssetCategories(context.companyId),
    getAccounts(context.companyId),
    getPartners(context.companyId),
    listCostCentersForClassification(context.companyId)
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Pencil className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Editar Bem Patrimonial</h2>
          <p className="text-sm text-gray-500">{asset.description}</p>
        </div>
      </div>
      <FixedAssetForm
        asset={asset}
        categories={categories.filter((c) => c.active)}
        chartAccounts={chartAccounts}
        partners={partners.filter((p) => p.active)}
        costCenters={costCenters}
      />
    </div>
  )
}
