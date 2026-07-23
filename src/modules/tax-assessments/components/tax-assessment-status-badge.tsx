import React from 'react'
import { TaxAssessmentStatus } from '../types'

const THEME: Record<TaxAssessmentStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  CALCULATED: 'bg-blue-50 text-blue-700 border-blue-200',
  REVIEWED: 'bg-amber-50 text-amber-700 border-amber-200',
  CLOSED: 'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200'
}

const LABELS: Record<TaxAssessmentStatus, string> = {
  DRAFT: 'Rascunho',
  CALCULATED: 'Calculada',
  REVIEWED: 'Revisada',
  CLOSED: 'Fechada',
  CANCELLED: 'Cancelada'
}

export function TaxAssessmentStatusBadge({ status }: { status: TaxAssessmentStatus | string }) {
  const theme = THEME[status as TaxAssessmentStatus] || 'bg-gray-50 text-gray-500 border-gray-200'
  const label = LABELS[status as TaxAssessmentStatus] || status
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${theme}`}>{label}</span>
}
