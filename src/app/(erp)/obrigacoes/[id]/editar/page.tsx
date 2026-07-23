import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import { getObligationById } from '@/modules/obligations/queries'
import { ObligationForm } from '@/modules/obligations/components/obligation-form'
import { Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EditObligationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()

  const obligation = await getObligationById(id, context.companyId)
  if (!obligation) notFound()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Pencil className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Editar Obrigação</h2>
          <p className="text-sm text-gray-500">{obligation.obligation_type}</p>
        </div>
      </div>
      <ObligationForm obligation={obligation} />
    </div>
  )
}
