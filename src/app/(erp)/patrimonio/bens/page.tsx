import React from 'react'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import { listFixedAssets } from '@/modules/assets/queries'
import { FixedAssetList } from '@/modules/assets/components/fixed-asset-list'
import { Boxes, Plus, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function FixedAssetsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const context = await getCurrentContext()

  let errorMsg: string | null = null
  let assets: Awaited<ReturnType<typeof listFixedAssets>> = []

  try {
    assets = await listFixedAssets(context.companyId, { status: params.status })
  } catch (error: any) {
    errorMsg = error.message || 'Falha ao carregar bens patrimoniais.'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Bens Patrimoniais</h2>
            <p className="text-sm text-gray-500">Ativo imobilizado da empresa.</p>
          </div>
        </div>
        <Link href="/patrimonio/bens/novo" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all">
          <Plus className="w-4 h-4" />
          Novo Bem
        </Link>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : (
        <FixedAssetList assets={assets} />
      )}
    </div>
  )
}
