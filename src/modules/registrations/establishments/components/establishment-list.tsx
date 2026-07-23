'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Establishment, ESTABLISHMENT_TYPE_LABELS } from '../types'
import { toggleEstablishmentActiveAction } from '../actions'
import { Pencil, Power, Building2 } from 'lucide-react'

interface EstablishmentListProps {
  establishments: Establishment[]
}

function EstablishmentCard({ establishment }: { establishment: Establishment }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const confirmMsg = establishment.active
      ? `Inativar o estabelecimento "${establishment.name || establishment.cnpj}"?`
      : `Reativar o estabelecimento "${establishment.name || establishment.cnpj}"?`

    if (!window.confirm(confirmMsg)) return

    startTransition(async () => {
      await toggleEstablishmentActiveAction({ id: establishment.id, active: !establishment.active })
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 flex-shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${
              establishment.type === 'HEADQUARTERS' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-purple-50 text-purple-700 border-purple-200'
            }`}>
              {ESTABLISHMENT_TYPE_LABELS[establishment.type]}
            </span>
            <span className="font-bold text-gray-800 text-sm truncate">{establishment.name || 'Sem nome'}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${establishment.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {establishment.active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {establishment.cnpj}
            {establishment.city ? ` · ${establishment.city}${establishment.state ? `/${establishment.state}` : ''}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/fiscal/cadastros/estabelecimentos/${establishment.id}/editar`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Link>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
            establishment.active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {establishment.active ? 'Inativar' : 'Reativar'}
        </button>
      </div>
    </div>
  )
}

export function EstablishmentList({ establishments }: EstablishmentListProps) {
  if (establishments.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <Building2 className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhum estabelecimento cadastrado</span>
        <p className="text-xs text-gray-400 max-w-xs">Empresas com uma só inscrição não precisam cadastrar estabelecimento — isso é para matriz/filiais.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {establishments.map((establishment) => (
        <EstablishmentCard key={establishment.id} establishment={establishment} />
      ))}
    </div>
  )
}
