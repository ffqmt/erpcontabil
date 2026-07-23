import React from 'react'
import { Partner } from '../types'
import { PARTNER_ROLE_LABELS } from '../partner-utils'

interface PartnerRoleBadgesProps {
  partner: Pick<Partner, 'is_customer' | 'is_supplier' | 'is_carrier' | 'is_employee'>
}

const THEME: Record<string, string> = {
  is_customer: 'bg-blue-50 text-blue-700 border-blue-200',
  is_supplier: 'bg-purple-50 text-purple-700 border-purple-200',
  is_carrier: 'bg-amber-50 text-amber-700 border-amber-200',
  is_employee: 'bg-emerald-50 text-emerald-700 border-emerald-200'
}

export function PartnerRoleBadges({ partner }: PartnerRoleBadgesProps) {
  const active = PARTNER_ROLE_LABELS.filter((role) => partner[role.key])

  if (active.length === 0) {
    return <span className="text-xs text-gray-400">Nenhum papel</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {active.map((role) => (
        <span
          key={role.key}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${THEME[role.key]}`}
        >
          {role.label}
        </span>
      ))}
    </div>
  )
}
