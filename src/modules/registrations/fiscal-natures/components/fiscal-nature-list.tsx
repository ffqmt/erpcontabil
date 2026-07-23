'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiscalOperationNature } from '../types'
import { toggleFiscalNatureActiveAction } from '../actions'
import { OPERATION_KIND_LABELS } from '../labels'
import { Pencil, Power, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, FileStack } from 'lucide-react'

interface FiscalNatureListProps {
  fiscalNatures: FiscalOperationNature[]
}

const DIRECTION_LABEL: Record<string, string> = {
  INBOUND: 'Entrada',
  OUTBOUND: 'Saída',
  BOTH: 'Ambas'
}

const DIRECTION_ICON: Record<string, typeof ArrowDownToLine> = {
  INBOUND: ArrowDownToLine,
  OUTBOUND: ArrowUpFromLine,
  BOTH: ArrowLeftRight
}

function FiscalNatureRow({ nature }: { nature: FiscalOperationNature }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const Icon = DIRECTION_ICON[nature.direction] || ArrowLeftRight

  function handleToggle() {
    const confirmMsg = nature.is_active
      ? `Inativar a natureza fiscal "${nature.name}"?`
      : `Reativar a natureza fiscal "${nature.name}"?`

    if (!window.confirm(confirmMsg)) return

    startTransition(async () => {
      await toggleFiscalNatureActiveAction({ id: nature.id, isActive: !nature.is_active })
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-gray-400">{nature.code}</span>
            <span className="font-bold text-gray-800 text-sm truncate">{nature.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${nature.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {nature.is_active ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {DIRECTION_LABEL[nature.direction]}
            {nature.operation_kind && ` · ${OPERATION_KIND_LABELS[nature.operation_kind]}`}
            {nature.default_bookkeeping_cfop && ` · CFOP ${nature.default_bookkeeping_cfop}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/cadastros/naturezas-fiscais/${nature.id}/editar`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Link>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
            nature.is_active
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-green-200 text-green-700 hover:bg-green-50'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {nature.is_active ? 'Inativar' : 'Reativar'}
        </button>
      </div>
    </div>
  )
}

export function FiscalNatureList({ fiscalNatures }: FiscalNatureListProps) {
  if (fiscalNatures.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <FileStack className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhuma natureza fiscal cadastrada</span>
        <p className="text-xs text-gray-400 max-w-xs">Clique em "Nova Natureza Fiscal" para cadastrar operações de entrada/saída.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {fiscalNatures.map((nature) => (
        <FiscalNatureRow key={nature.id} nature={nature} />
      ))}
    </div>
  )
}
