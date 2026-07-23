import React from 'react'
import { AlertCircle, Banknote, FileStack, WalletCards } from 'lucide-react'
import { PayrollDashboardData } from '../types'
import { formatCurrencyBRL } from '../utils'

function Card({ title, value, hint, icon: Icon, tone = 'gray' }: {
  title: string
  value: string | number
  hint: string
  icon: React.ElementType
  tone?: 'gray' | 'emerald' | 'amber' | 'blue'
}) {
  const toneClass = {
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100'
  }[tone]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg border ${toneClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">{title}</p>
        <p className="text-lg font-black text-gray-800 mt-1">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
      </div>
    </div>
  )
}

export function PayrollDashboardCards({ data }: { data: PayrollDashboardData }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Card title="Eventos" value={data.eventsThisCompetence} hint="Eventos do eSocial na competência" icon={FileStack} tone="blue" />
      <Card title="Bruto" value={formatCurrencyBRL(data.grossAmount)} hint="Soma de rubricas importadas" icon={Banknote} tone="gray" />
      <Card title="Líquido" value={formatCurrencyBRL(data.netAmount)} hint="Valores líquidos identificados" icon={WalletCards} tone="emerald" />
      <Card title="Pendentes" value={data.notAccountedCount} hint="Ainda sem contabilização" icon={AlertCircle} tone="amber" />
    </div>
  )
}
