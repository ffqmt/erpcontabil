import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getFiscalNatures } from '@/modules/registrations/fiscal-natures/queries'
import { ItemForm } from '@/modules/registrations/items/components/item-form'
import { PackagePlus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NewItemPage() {
  const context = await getCurrentContext()
  const fiscalNatures = await getFiscalNatures(context.companyId)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <PackagePlus className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Novo Produto/Serviço</h2>
          <p className="text-sm text-gray-500">Cadastre um item para uso futuro pelos módulos Fiscal e Financeiro.</p>
        </div>
      </div>
      <ItemForm fiscalNatures={fiscalNatures.filter((n) => n.is_active)} />
    </div>
  )
}
