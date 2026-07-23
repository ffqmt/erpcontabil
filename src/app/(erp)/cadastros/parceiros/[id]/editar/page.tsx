import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import { getPartnerById } from '@/modules/registrations/partners/queries'
import { PartnerForm } from '@/modules/registrations/partners/components/partner-form'
import { Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EditPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()
  const partner = await getPartnerById(id, context.companyId)

  if (!partner) {
    notFound()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Pencil className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Editar Parceiro</h2>
          <p className="text-sm text-gray-500">{partner.name}</p>
        </div>
      </div>
      <PartnerForm partner={partner} />
    </div>
  )
}
