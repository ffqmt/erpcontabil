import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getPartners } from '@/modules/registrations/partners/queries'
import { getFiscalNatures } from '@/modules/registrations/fiscal-natures/queries'
import { FiscalDocumentForm } from '@/modules/fiscal/components/fiscal-document-form'
import { FilePlus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NewFiscalDocumentPage() {
  const context = await getCurrentContext()
  const [partners, natures] = await Promise.all([
    getPartners(context.companyId),
    getFiscalNatures(context.companyId)
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <FilePlus className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Novo Documento Fiscal</h2>
          <p className="text-sm text-gray-500">Lançamento manual de documento fiscal (para importação de XML, utilize a opção "Importar XML").</p>
        </div>
      </div>
      <FiscalDocumentForm partners={partners.filter((p) => p.active)} natures={natures.filter((n) => n.is_active)} />
    </div>
  )
}
