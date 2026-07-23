import React from 'react'
import { AccountType, NormalBalance } from '../types'

interface BadgeProps {
  label: string
  className: string
}

function Badge({ label, className }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${className}`}>
      {label}
    </span>
  )
}

export function TypeBadge({ type }: { type: AccountType }) {
  switch (type) {
    case 'ASSET':
      return <Badge label="Ativo" className="bg-blue-100 text-blue-800 border border-blue-200" />
    case 'LIABILITY':
      return <Badge label="Passivo" className="bg-orange-100 text-orange-800 border border-orange-200" />
    case 'EQUITY':
      return <Badge label="PL" className="bg-purple-100 text-purple-800 border border-purple-200" />
    case 'REVENUE':
      return <Badge label="Receita" className="bg-green-100 text-green-800 border border-green-200" />
    case 'REVENUE_DEDUCTION':
      return <Badge label="Dedução" className="bg-pink-100 text-pink-800 border border-pink-200" />
    case 'COST':
      return <Badge label="Custo" className="bg-indigo-100 text-indigo-800 border border-indigo-200" />
    case 'EXPENSE':
      return <Badge label="Despesa" className="bg-rose-100 text-rose-800 border border-rose-200" />
    default:
      return <Badge label={type} className="bg-gray-100 text-gray-800 border border-gray-200" />
  }
}

export function BalanceBadge({ balance }: { balance: NormalBalance }) {
  if (balance === 'DEBIT') {
    return <Badge label="Devedora (D)" className="bg-cyan-50 text-cyan-800 border border-cyan-200 font-mono text-[10px]" />
  }
  return <Badge label="Credora (C)" className="bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px]" />
}

export function SyntheticBadge({ isSynthetic }: { isSynthetic: boolean }) {
  if (isSynthetic) {
    return <Badge label="Sintética" className="bg-gray-200 text-gray-800 border border-gray-300" />
  }
  return <Badge label="Analítica" className="bg-gray-100 text-gray-600 border border-gray-200" />
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-700 font-medium">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Ativa
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 font-medium">
      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" /> Inativa
    </span>
  )
}
