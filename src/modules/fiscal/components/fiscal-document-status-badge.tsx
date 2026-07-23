import React from 'react'
import { FiscalDocumentStatus } from '../types'
import { FISCAL_DOCUMENT_STATUS_LABELS } from '../utils'

const THEME: Record<FiscalDocumentStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  IMPORTED: 'bg-blue-50 text-blue-700 border-blue-200',
  VALIDATED: 'bg-amber-50 text-amber-700 border-amber-200',
  BOOKED: 'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200'
}

export function FiscalDocumentStatusBadge({ status }: { status: FiscalDocumentStatus | string }) {
  const theme = THEME[status as FiscalDocumentStatus] || 'bg-gray-50 text-gray-500 border-gray-200'
  const label = FISCAL_DOCUMENT_STATUS_LABELS[status as FiscalDocumentStatus] || status
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${theme}`}>
      {label}
    </span>
  )
}
