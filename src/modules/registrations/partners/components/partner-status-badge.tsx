import React from 'react'

interface PartnerStatusBadgeProps {
  active: boolean
}

export function PartnerStatusBadge({ active }: PartnerStatusBadgeProps) {
  if (active) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
        Ativo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
      Inativo
    </span>
  )
}
