import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { listFiscalPendencies, computePendencyCounters } from '@/modules/fiscal/validation-issues/queries'
import { getPartnerOptions } from '@/modules/registrations/partners/queries'
import { FiscalPendenciesView } from '@/modules/fiscal/validation-issues/components/fiscal-pendencies-view'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ competence?: string; documentType?: string; direction?: string; partnerId?: string }>
}

export default async function FiscalPendenciasPage({ searchParams }: PageProps) {
  const params = await searchParams
  const context = await getCurrentContext()

  let errorMsg: string | null = null
  let pendencies: Awaited<ReturnType<typeof listFiscalPendencies>> = []
  let partners: Awaited<ReturnType<typeof getPartnerOptions>> = []

  try {
    ;[pendencies, partners] = await Promise.all([
      listFiscalPendencies(context.companyId, {
        competence: params.competence,
        documentType: params.documentType,
        direction: params.direction,
        partnerId: params.partnerId,
        limit: 200
      }),
      getPartnerOptions(context.companyId, { limit: 500 })
    ])
  } catch (error: unknown) {
    errorMsg = error instanceof Error ? error.message : 'Falha ao carregar a central de pendências fiscais.'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Pendências Fiscais</h2>
            <p className="text-sm text-gray-500">Painel único de escrituração: itens sem produto, CFOP/NCM/CST inconsistentes, contabilização e apuração pendentes.</p>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : (
        <FiscalPendenciesView pendencies={pendencies} partners={partners} counters={computePendencyCounters(pendencies)} />
      )}
    </div>
  )
}
