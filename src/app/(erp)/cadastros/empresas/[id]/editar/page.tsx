import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import { getCompanyById } from '@/modules/registrations/companies/queries'
import { CompanyForm } from '@/modules/registrations/companies/components/company-form'
import { Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()
  const company = await getCompanyById(id, context.workspaceId)

  if (!company) {
    notFound()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Pencil className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Editar Empresa</h2>
          <p className="text-sm text-gray-500">{company.legal_name}</p>
        </div>
      </div>
      <CompanyForm company={company} />
    </div>
  )
}
