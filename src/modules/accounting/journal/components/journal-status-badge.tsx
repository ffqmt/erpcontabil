import React from 'react'
import { JournalStatus } from '../types'

interface StatusBadgeProps {
  status: JournalStatus | string
}

export function JournalStatusBadge({ status }: StatusBadgeProps) {
  switch (status?.toUpperCase()) {
    case 'DRAFT':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
          Rascunho
        </span>
      )
    case 'POSTED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
          Publicado
        </span>
      )
    case 'REVERSED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Estornado
        </span>
      )
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-150 text-red-700 border border-red-200">
          Cancelado
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
