import React from 'react'
import { AssetStatus } from '../types'
import { ASSET_STATUS_LABELS } from '../utils'

const THEME: Record<AssetStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  FULLY_DEPRECIATED: 'bg-blue-50 text-blue-700 border-blue-200',
  DISPOSED: 'bg-gray-100 text-gray-500 border-gray-200',
  SOLD: 'bg-purple-50 text-purple-700 border-purple-200',
  INACTIVE: 'bg-red-50 text-red-700 border-red-200'
}

export function AssetStatusBadge({ status }: { status: AssetStatus | string }) {
  const theme = THEME[status as AssetStatus] || 'bg-gray-50 text-gray-500 border-gray-200'
  const label = ASSET_STATUS_LABELS[status as AssetStatus] || status
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${theme}`}>{label}</span>
}
