'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Partner } from '../types'
import { togglePartnerActiveAction } from '../actions'
import { PartnerStatusBadge } from './partner-status-badge'
import { PartnerRoleBadges } from './partner-role-badges'
import { formatDocument } from '../partner-utils'
import { Pencil, Power } from 'lucide-react'

interface PartnerCardProps {
  partner: Partner
}

export function PartnerCard({ partner }: PartnerCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const confirmMsg = partner.active
      ? `Inativar o parceiro "${partner.name}"? Ele deixará de aparecer como opção em novos lançamentos/documentos.`
      : `Reativar o parceiro "${partner.name}"?`

    if (!window.confirm(confirmMsg)) return

    startTransition(async () => {
      await togglePartnerActiveAction({ id: partner.id, active: !partner.active })
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between hover:shadow-sm transition-shadow">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-800 text-sm truncate">{partner.name}</span>
          <PartnerStatusBadge active={partner.active} />
        </div>
        <p className="text-xs text-gray-500 font-mono">{formatDocument(partner.document, partner.document_type)}</p>
        <PartnerRoleBadges partner={partner} />
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/cadastros/parceiros/${partner.id}/editar`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Link>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
            partner.active
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-green-200 text-green-700 hover:bg-green-50'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {partner.active ? 'Inativar' : 'Reativar'}
        </button>
      </div>
    </div>
  )
}
