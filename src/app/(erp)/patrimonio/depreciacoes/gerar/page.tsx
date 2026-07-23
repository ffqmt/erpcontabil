import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { GenerateDepreciationForm } from '@/modules/assets/components/generate-depreciation-form'
import { Calculator } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function GenerateAssetDepreciationsPage() {
  const context = await getCurrentContext()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Calculator className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Gerar Depreciação</h2>
          <p className="text-sm text-gray-500">Calcula a depreciação linear mensal dos bens ativos.</p>
        </div>
      </div>
      <GenerateDepreciationForm defaultCompetence={context.competence} />
    </div>
  )
}
