import React from 'react'
import { ObligationWorkflowStatus } from '../types'
import { OBLIGATION_STATUS_LABELS } from '../utils'

const THEME: Record<ObligationWorkflowStatus, string> = {
  OPEN: 'bg-gray-100 text-gray-600 border-gray-200',
  GENERATED: 'bg-blue-50 text-blue-700 border-blue-200',
  PAID: 'bg-green-50 text-green-700 border-green-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OVERDUE: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-400 border-gray-200'
}

export function ObligationStatusBadge({ status }: { status: ObligationWorkflowStatus | string }) {
  const theme = THEME[status as ObligationWorkflowStatus] || 'bg-gray-50 text-gray-500 border-gray-200'
  const label = OBLIGATION_STATUS_LABELS[status as ObligationWorkflowStatus] || status
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${theme}`}>{label}</span>
}
