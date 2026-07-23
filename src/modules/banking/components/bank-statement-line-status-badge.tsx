import React from 'react'
import { BankStatementLineStatus } from '../types'

interface BankStatementLineStatusBadgeProps {
  status: BankStatementLineStatus | string
}

export function BankStatementLineStatusBadge({ status }: BankStatementLineStatusBadgeProps) {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Pendente
        </span>
      )
    case 'CLASSIFIED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Classificada
        </span>
      )
    case 'RECONCILED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
          Conciliada
        </span>
      )
    case 'IGNORED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
          Ignorada
        </span>
      )
    case 'ERROR':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          Erro
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
