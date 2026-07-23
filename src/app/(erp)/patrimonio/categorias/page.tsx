import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { listAssetCategories } from '@/modules/assets/queries'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { AssetCategoryList } from '@/modules/assets/components/asset-category-list'
import { AssetCategoryForm } from '@/modules/assets/components/asset-category-form'
import { Boxes, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AssetCategoriesPage() {
  const context = await getCurrentContext()

  let errorMsg: string | null = null
  let categories: Awaited<ReturnType<typeof listAssetCategories>> = []
  let chartAccounts: Awaited<ReturnType<typeof getAccounts>> = []

  try {
    ;[categories, chartAccounts] = await Promise.all([
      listAssetCategories(context.companyId),
      getAccounts(context.companyId)
    ])
  } catch (error: any) {
    errorMsg = error.message || 'Falha ao carregar categorias patrimoniais.'
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Boxes className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Categorias Patrimoniais</h2>
          <p className="text-sm text-gray-500">Vida útil e contas contábeis padrão por categoria de bem.</p>
        </div>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : (
        <>
          <AssetCategoryList categories={categories} />
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Nova Categoria</h3>
            <AssetCategoryForm chartAccounts={chartAccounts} />
          </div>
        </>
      )}
    </div>
  )
}
