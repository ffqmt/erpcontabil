'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AssetDepreciation } from '../types'
import { formatCurrencyBRL, formatCompetenceBR } from '../utils'
import { postAssetDepreciationAction } from '../actions'
import { Calculator, Zap } from 'lucide-react'

const STATUS_THEME: Record<string, string> = {
  CALCULATED: 'bg-amber-50 text-amber-700 border-amber-200',
  POSTED: 'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200'
}

const STATUS_LABEL: Record<string, string> = {
  CALCULATED: 'Calculada',
  POSTED: 'Contabilizada',
  CANCELLED: 'Cancelada'
}

export function AssetDepreciationList({ depreciations }: { depreciations: AssetDepreciation[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handlePost(id: string) {
    startTransition(async () => {
      await postAssetDepreciationAction({ id })
      router.refresh()
    })
  }

  if (depreciations.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <Calculator className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhuma depreciação gerada ainda</span>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
          <tr>
            <th className="text-left px-4 py-3 font-semibold">Bem</th>
            <th className="text-left px-4 py-3 font-semibold">Competência</th>
            <th className="text-right px-4 py-3 font-semibold">Valor</th>
            <th className="text-left px-4 py-3 font-semibold">Status</th>
            <th className="text-right px-4 py-3 font-semibold">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {depreciations.map((dep) => (
            <tr key={dep.id}>
              <td className="px-4 py-2.5 text-gray-700">{dep.fixed_asset?.code || dep.fixed_asset?.description || '—'}</td>
              <td className="px-4 py-2.5 text-gray-500 font-mono">{formatCompetenceBR(dep.competence)}</td>
              <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatCurrencyBRL(dep.accounting_amount)}</td>
              <td className="px-4 py-2.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${STATUS_THEME[dep.status] || STATUS_THEME.CALCULATED}`}>
                  {STATUS_LABEL[dep.status] || dep.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                {dep.status === 'CALCULATED' && (
                  <button onClick={() => handlePost(dep.id)} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
                    <Zap className="w-3.5 h-3.5" />
                    Contabilizar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
