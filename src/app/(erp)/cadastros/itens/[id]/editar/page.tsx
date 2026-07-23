import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import { getItemById } from '@/modules/registrations/items/queries'
import { getFiscalNatures } from '@/modules/registrations/fiscal-natures/queries'
import { ItemForm } from '@/modules/registrations/items/components/item-form'
import { Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()
  const [item, fiscalNatures] = await Promise.all([
    getItemById(id, context.companyId),
    getFiscalNatures(context.companyId)
  ])

  if (!item) {
    notFound()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Pencil className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Editar Item</h2>
          <p className="text-sm text-gray-500">{item.name}</p>
        </div>
      </div>
      <ItemForm item={item} fiscalNatures={fiscalNatures.filter((n) => n.is_active)} />
    </div>
  )
}
