import React from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import { getFixedAssetById } from '@/modules/assets/queries'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { AssetStatusBadge } from '@/modules/assets/components/asset-status-badge'
import { FixedAssetDisposeForm } from '@/modules/assets/components/fixed-asset-dispose-form'
import { formatCurrencyBRL, formatDateBR } from '@/modules/assets/utils'
import { Boxes, Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function FixedAssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()

  const [asset, chartAccounts] = await Promise.all([
    getFixedAssetById(id, context.companyId),
    getAccounts(context.companyId)
  ])
  if (!asset) notFound()

  const canEdit = asset.status !== 'DISPOSED' && asset.status !== 'SOLD'

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">{asset.description}</h2>
            <p className="text-sm text-gray-500">{asset.code || '—'} · {asset.category?.name || 'Sem categoria'}</p>
          </div>
        </div>
        <AssetStatusBadge status={asset.status} />
      </div>

      <div className="flex items-center gap-2">
        {canEdit && (
          <Link href={`/patrimonio/bens/${asset.id}/editar`} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 text-gray-600 hover:text-emerald-700 text-xs font-semibold rounded-lg transition-colors">
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </Link>
        )}
        <FixedAssetDisposeForm asset={asset} chartAccounts={chartAccounts} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Valores</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><span className="text-[10px] text-gray-400 block">Aquisição</span><span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(asset.acquisition_amount)}</span></div>
          <div><span className="text-[10px] text-gray-400 block">Residual</span><span className="font-mono text-gray-700">{formatCurrencyBRL(asset.residual_amount)}</span></div>
          <div><span className="text-[10px] text-gray-400 block">Depreciação Acumulada</span><span className="font-mono text-gray-700">{formatCurrencyBRL(asset.accumulated_depreciation)}</span></div>
          <div><span className="text-[10px] text-gray-400 block">Valor Contábil Líquido</span><span className="font-mono font-bold text-emerald-700">{formatCurrencyBRL(asset.net_book_value)}</span></div>
          <div><span className="text-[10px] text-gray-400 block">Data de Aquisição</span><span className="text-gray-700">{formatDateBR(asset.acquisition_date)}</span></div>
          <div><span className="text-[10px] text-gray-400 block">Vida Útil</span><span className="text-gray-700">{asset.useful_life_months} meses</span></div>
        </div>
      </div>
    </div>
  )
}
