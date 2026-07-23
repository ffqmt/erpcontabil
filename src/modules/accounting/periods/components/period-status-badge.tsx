import React from 'react'
import { PeriodStatus } from '../types'

interface StatusBadgeProps {
  status: PeriodStatus | string
}

export function PeriodStatusBadge({ status }: StatusBadgeProps) {
  switch (status?.toUpperCase()) {
    case 'OPEN':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
          Aberto
        </span>
      )
    case 'CLOSED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          Fechado
        </span>
      )
    case 'IN_REVIEW':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Em Revisão
        </span>
      )
    case 'REOPENED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Reaberto
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200">
          {status}
        </span>
      )
  }
}
