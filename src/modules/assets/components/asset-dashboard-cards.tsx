import React from 'react'
import Link from 'next/link'
import { AssetsDashboardData } from '../types'
import { formatCurrencyBRL } from '../utils'
import { Boxes, CheckCircle, Archive, TrendingDown, Plus, ListChecks, Calculator } from 'lucide-react'

function StatCard({ title, value, subtext, icon: Icon, theme = 'gray' }: { title: string; value: string | number; subtext: string; icon: React.ComponentType<any>; theme?: 'green' | 'red' | 'blue' | 'amber' | 'gray' }) {
  const THEME: Record<string, string> = {
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    gray: 'bg-gray-50 text-gray-500 border-gray-200'
  }
  return (
    <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm flex items-start justify-between gap-4">
      <div className="space-y-2">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{title}</span>
        <h4 className="text-xl font-bold text-gray-800 tracking-tight">{value}</h4>
        <span className="text-[10px] text-gray-400 block font-medium">{subtext}</span>
      </div>
      <div className={`p-2.5 rounded-lg border ${THEME[theme]}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  )
}

export function AssetDashboardCards({ data }: { data: AssetsDashboardData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title="Bens Ativos" value={data.activeCount} subtext="Depreciando normalmente" icon={Boxes} theme="green" />
        <StatCard title="Totalmente Depreciados" value={data.fullyDepreciatedCount} subtext="Valor contábil líquido no residual" icon={CheckCircle} theme="blue" />
        <StatCard title="Baixados" value={data.disposedCount} subtext="Vendidos ou baixados" icon={Archive} theme="gray" />
        <StatCard title="Valor de Aquisição (Ativos)" value={formatCurrencyBRL(data.totalAcquisitionValue)} subtext="Soma dos bens não baixados" icon={Boxes} theme="gray" />
        <StatCard title="Valor Contábil Líquido" value={formatCurrencyBRL(data.totalNetBookValue)} subtext="Aquisição - depreciação acumulada" icon={TrendingDown} theme="amber" />
        <StatCard title="Depreciações Pendentes" value={data.pendingDepreciationsCount} subtext="Calculadas, aguardando contabilização" icon={Calculator} theme="red" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/patrimonio/bens/novo" className="p-4 border border-gray-150 hover:border-emerald-500 rounded-lg group transition-all flex items-start gap-3 bg-white">
          <Plus className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors mt-0.5" />
          <div>
            <span className="font-bold text-gray-800 text-sm block group-hover:text-emerald-700 transition-colors">Novo Bem</span>
            <p className="text-[11px] text-gray-400 leading-normal">Cadastrar ativo imobilizado</p>
          </div>
        </Link>
        <Link href="/patrimonio/bens" className="p-4 border border-gray-150 hover:border-emerald-500 rounded-lg group transition-all flex items-start gap-3 bg-white">
          <ListChecks className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors mt-0.5" />
          <div>
            <span className="font-bold text-gray-800 text-sm block group-hover:text-emerald-700 transition-colors">Todos os Bens</span>
            <p className="text-[11px] text-gray-400 leading-normal">Listar, editar, baixar</p>
          </div>
        </Link>
        <Link href="/patrimonio/depreciacoes/gerar" className="p-4 border border-gray-150 hover:border-emerald-500 rounded-lg group transition-all flex items-start gap-3 bg-white">
          <Calculator className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors mt-0.5" />
          <div>
            <span className="font-bold text-gray-800 text-sm block group-hover:text-emerald-700 transition-colors">Gerar Depreciação</span>
            <p className="text-[11px] text-gray-400 leading-normal">Calcular a competência ativa</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
