import React from 'react'
import { FixedAsset } from '../types'
import { FixedAssetCard } from './fixed-asset-card'
import { Boxes } from 'lucide-react'

export function FixedAssetList({ assets }: { assets: FixedAsset[] }) {
  if (assets.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <Boxes className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhum bem patrimonial cadastrado</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {assets.map((asset) => (
        <FixedAssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  )
}
