import React from 'react'
import Link from 'next/link'
import { FixedAsset } from '../types'
import { formatCurrencyBRL, formatDateBR } from '../utils'
import { AssetStatusBadge } from './asset-status-badge'
import { Boxes, ChevronRight } from 'lucide-react'

export function FixedAssetCard({ asset }: { asset: FixedAsset }) {
  return (
    <Link href={`/patrimonio/bens/${asset.id}`} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4 hover:shadow-sm hover:border-emerald-300 transition-all">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 flex-shrink-0">
          <Boxes className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {asset.code && <span className="font-mono text-xs text-gray-400">{asset.code}</span>}
            <span className="font-semibold text-gray-800 text-sm truncate">{asset.description}</span>
            <AssetStatusBadge status={asset.status} />
          </div>
          <p className="text-[11px] text-gray-400">
            {asset.category?.name || 'Sem categoria'} · Aquisição {formatDateBR(asset.acquisition_date)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <span className="font-mono font-bold text-sm text-gray-800 block">{formatCurrencyBRL(asset.net_book_value ?? asset.acquisition_amount)}</span>
          <span className="text-[10px] text-gray-400">valor líquido</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </Link>
  )
}
