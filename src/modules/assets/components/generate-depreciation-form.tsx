'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateAssetDepreciationsAction } from '../actions'
import { AlertCircle, CheckCircle, Calculator } from 'lucide-react'

export function GenerateDepreciationForm({ defaultCompetence }: { defaultCompetence: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [competence, setCompetence] = useState(defaultCompetence.substring(0, 7))
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await generateAssetDepreciationsAction({ competence: `${competence}-01` })
      if (res.ok) {
        setSuccessMsg(res.message || 'Depreciações geradas.')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gerar Depreciação da Competência</h3>
      <p className="text-[11px] text-gray-400">
        Calcula a depreciação linear mensal de todos os bens ATIVOS que ainda não têm depreciação calculada nesta competência. Bens que atingem o valor residual são marcados automaticamente como Totalmente Depreciados.
      </p>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="flex items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Competência</label>
          <input type="month" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" value={competence} onChange={(e) => setCompetence(e.target.value)} required />
        </div>
        <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer">
          <Calculator className="w-4 h-4" />
          {isPending ? 'Gerando...' : 'Gerar Depreciações'}
        </button>
      </div>
    </form>
  )
}
