import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import { getEstablishmentById } from '@/modules/registrations/establishments/queries'
import { EstablishmentForm } from '@/modules/registrations/establishments/components/establishment-form'
import { Building2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EditEstablishmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()

  const establishment = await getEstablishmentById(id, context.companyId)
  if (!establishment) notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Editar Estabelecimento</h2>
          <p className="text-sm text-gray-500">{establishment.name || establishment.cnpj}</p>
        </div>
      </div>
      <EstablishmentForm establishment={establishment} />
    </div>
  )
}
