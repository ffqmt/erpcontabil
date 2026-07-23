'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, AlertCircle } from 'lucide-react'
import { setActiveCompanyAction } from '@/lib/context/actions'

interface CompanyOption {
  id: string
  legal_name: string
}

interface CompanySwitcherProps {
  companyId: string
  legalName: string
  companies: CompanyOption[]
}

// Antes: componente decorativo (TODO nunca implementado — getCurrentContext() sempre caía
// no fallback DEV_COMPANY_ID, então trocar de empresa não tinha efeito nenhum). Agora troca
// de verdade via cookie, validado contra a RLS do usuário autenticado em
// setActiveCompanyAction (nunca confia no id só porque veio de uma option renderizada).
export function CompanySwitcher({ companyId, legalName, companies }: CompanySwitcherProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = e.target.value
    if (!newId || newId === companyId) return
    setError(null)
    startTransition(async () => {
      const res = await setActiveCompanyAction(newId)
      if (res.ok) {
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
      <div className="p-2 bg-emerald-100 text-emerald-800 rounded-md">
        <Building2 className="w-5 h-5" />
      </div>
      <div className="flex flex-col overflow-hidden">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Empresa Ativa</span>
        {companies.length > 1 ? (
          <select
            value={companyId}
            onChange={handleChange}
            disabled={isPending}
            className="text-sm font-medium text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0 cursor-pointer disabled:opacity-50 max-w-[220px]"
            title="Trocar empresa ativa"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.legal_name}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-medium text-gray-800 truncate" title={legalName}>
            {legalName || 'Nenhuma Empresa Selecionada'}
          </span>
        )}
        {error && (
          <span className="text-[10px] text-red-600 font-semibold flex items-center gap-1 mt-0.5">
            <AlertCircle className="w-3 h-3" /> {error}
          </span>
        )}
      </div>
    </div>
  )
}
