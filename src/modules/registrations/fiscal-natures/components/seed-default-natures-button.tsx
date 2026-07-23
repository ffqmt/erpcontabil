'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { seedDefaultFiscalNaturesAction } from '../actions'
import { Sparkles, Loader2 } from 'lucide-react'

export function SeedDefaultNaturesButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function handleClick() {
    setMessage(null)
    startTransition(async () => {
      const res = await seedDefaultFiscalNaturesAction()
      setMessage(res.ok ? res.message || 'Concluído.' : res.error)
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 font-semibold text-sm rounded-lg transition-all disabled:opacity-50 cursor-pointer"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        Criar Naturezas Fiscais Padrão
      </button>
      {message && <p className="text-[11px] text-gray-500 max-w-xs text-right">{message}</p>}
    </div>
  )
}
