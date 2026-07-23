'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Item } from '../types'
import { toggleItemActiveAction } from '../actions'
import { ITEM_TYPE_LABELS } from '../item-utils'
import { Pencil, Power, Package, Wrench } from 'lucide-react'

interface ItemCardProps {
  item: Item
}

export function ItemCard({ item }: ItemCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const confirmMsg = item.active
      ? `Inativar o item "${item.name}"?`
      : `Reativar o item "${item.name}"?`

    if (!window.confirm(confirmMsg)) return

    startTransition(async () => {
      await toggleItemActiveAction({ id: item.id, active: !item.active })
      router.refresh()
    })
  }

  const Icon = item.item_type === 'PRODUCT' ? Package : Wrench

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between hover:shadow-sm transition-shadow">
      <div className="space-y-1 min-w-0 flex items-start gap-3">
        <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-gray-400">{item.code}</span>
            <span className="font-bold text-gray-800 text-sm truncate">{item.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${item.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {item.active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p className="text-xs text-gray-500">{ITEM_TYPE_LABELS[item.item_type]}{item.unit ? ` · Unidade: ${item.unit}` : ''}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/cadastros/itens/${item.id}/editar`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Link>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
            item.active
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-green-200 text-green-700 hover:bg-green-50'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {item.active ? 'Inativar' : 'Reativar'}
        </button>
      </div>
    </div>
  )
}
