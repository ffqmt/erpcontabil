'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AssetCategory } from '../types'
import { toggleAssetCategoryActiveAction } from '../actions'
import { Boxes, Power } from 'lucide-react'

export function AssetCategoryList({ categories }: { categories: AssetCategory[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggle(cat: AssetCategory) {
    const msg = cat.active ? `Inativar a categoria "${cat.name}"?` : `Reativar a categoria "${cat.name}"?`
    if (!window.confirm(msg)) return
    startTransition(async () => {
      await toggleAssetCategoryActiveAction({ id: cat.id, active: !cat.active })
      router.refresh()
    })
  }

  if (categories.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <Boxes className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhuma categoria patrimonial cadastrada</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-800 text-sm">{cat.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${cat.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {cat.active ? 'Ativa' : 'Inativa'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Vida útil padrão: {cat.default_useful_life_months} meses</p>
          </div>
          <button onClick={() => handleToggle(cat)} disabled={isPending} className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${cat.active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
            <Power className="w-3.5 h-3.5" />
            {cat.active ? 'Inativar' : 'Reativar'}
          </button>
        </div>
      ))}
    </div>
  )
}
