import React from 'react'
import Link from 'next/link'
import { BankingDashboardData } from '../types'
import { formatCurrencyBRL } from '../utils'
import { Landmark, FileStack, Clock, CheckCircle, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Upload, ListChecks } from 'lucide-react'

interface BankingDashboardCardsProps {
  data: BankingDashboardData
}

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

export function BankingDashboardCards({ data }: BankingDashboardCardsProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title="Contas Bancárias Ativas" value={data.bankAccountsCount} subtext="Cadastradas em Cadastros > Contas Bancárias" icon={Landmark} theme="blue" />
        <StatCard title="Importações Realizadas" value={data.importsCount} subtext="Total de lotes de extrato importados" icon={FileStack} theme="gray" />
        <StatCard title="Linhas Pendentes" value={data.pendingLinesCount} subtext="Aguardando classificação/conciliação" icon={Clock} theme="amber" />
        <StatCard title="Conciliadas no Mês" value={data.reconciledThisMonthCount} subtext="Linhas conciliadas na competência atual" icon={CheckCircle} theme="green" />
        <StatCard title="Entradas Pendentes" value={formatCurrencyBRL(data.totalPendingInflow)} subtext="Soma de linhas positivas ainda pendentes" icon={ArrowDownToLine} theme="green" />
        <StatCard title="Saídas Pendentes" value={formatCurrencyBRL(data.totalPendingOutflow)} subtext="Soma de linhas negativas ainda pendentes" icon={ArrowUpFromLine} theme="red" />
      </div>

      {data.errorLinesCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-2.5 items-start">
          <AlertTriangle className="w-4.5 h-4.5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">
            {data.errorLinesCount} linha(s) com erro de importação — revise em <Link href="/bancos/conciliacao?status=ERROR" className="underline font-semibold">Conciliação</Link>.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/bancos/importar" className="p-4 border border-gray-150 hover:border-emerald-500 rounded-lg group transition-all flex items-start gap-3 bg-white">
          <Upload className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors mt-0.5" />
          <div>
            <span className="font-bold text-gray-800 text-sm block group-hover:text-emerald-700 transition-colors">Importar Extrato CSV</span>
            <p className="text-[11px] text-gray-400 leading-normal">Envie um novo extrato para classificação</p>
          </div>
        </Link>
        <Link href="/bancos/conciliacao" className="p-4 border border-gray-150 hover:border-emerald-500 rounded-lg group transition-all flex items-start gap-3 bg-white">
          <ListChecks className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors mt-0.5" />
          <div>
            <span className="font-bold text-gray-800 text-sm block group-hover:text-emerald-700 transition-colors">Ver Pendências</span>
            <p className="text-[11px] text-gray-400 leading-normal">Classificar e conciliar linhas de extrato</p>
          </div>
        </Link>
        <Link href="/cadastros/contas-bancarias" className="p-4 border border-gray-150 hover:border-emerald-500 rounded-lg group transition-all flex items-start gap-3 bg-white">
          <Landmark className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors mt-0.5" />
          <div>
            <span className="font-bold text-gray-800 text-sm block group-hover:text-emerald-700 transition-colors">Contas Bancárias</span>
            <p className="text-[11px] text-gray-400 leading-normal">Gerenciar cadastro de contas bancárias</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
