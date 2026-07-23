import React from 'react'
import { Item } from '../types'
import { ItemCard } from './item-card'
import { Package } from 'lucide-react'

interface ItemListProps {
  items: Item[]
}

export function ItemList({ items }: ItemListProps) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <Package className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhum produto/serviço cadastrado</span>
        <p className="text-xs text-gray-400 max-w-xs">Clique em "Novo Item" para cadastrar produtos ou serviços.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  )
}
