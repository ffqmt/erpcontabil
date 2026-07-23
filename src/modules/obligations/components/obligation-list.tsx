import React from 'react'
import { Obligation } from '../types'
import { ObligationCard } from './obligation-card'
import { ListChecks } from 'lucide-react'

export function ObligationList({ obligations }: { obligations: Obligation[] }) {
  if (obligations.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <ListChecks className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhuma obrigação cadastrada</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {obligations.map((o) => (
        <ObligationCard key={o.id} obligation={o} />
      ))}
    </div>
  )
}
