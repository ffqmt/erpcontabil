import React from 'react'
import Link from 'next/link'
import { FiscalDashboardData } from '../types'
import { formatCurrencyBRL } from '../utils'
import { FileStack, FileClock, FileCheck, FileWarning, ArrowDownToLine, ArrowUpFromLine, Plus, ListChecks } from 'lucide-react'

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

export function FiscalDashboardCards({ data }: { data: FiscalDashboardData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title="Documentos no Mês" value={data.documentsThisMonth} subtext="Total de documentos fiscais na competência" icon={FileStack} theme="gray" />
        <StatCard title="Rascunho/Importados" value={data.draftCount} subtext="Aguardando validação" icon={FileClock} theme="amber" />
        <StatCard title="Escriturados" value={data.bookedCount} subtext="Já escriturados fiscalmente" icon={FileCheck} theme="green" />
        <StatCard title="Não Contabilizados" value={data.notAccountedCount} subtext="Sem lançamento contábil gerado" icon={FileWarning} theme="red" />
        <StatCard title="Entradas no Mês" value={formatCurrencyBRL(data.inboundTotal)} subtext="Total de documentos de entrada" icon={ArrowDownToLine} theme="blue" />
        <StatCard title="Saídas no Mês" value={formatCurrencyBRL(data.outboundTotal)} subtext="Total de documentos de saída" icon={ArrowUpFromLine} theme="blue" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/fiscal/documentos/novo" className="p-4 border border-gray-150 hover:border-emerald-500 rounded-lg group transition-all flex items-start gap-3 bg-white">
          <Plus className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors mt-0.5" />
          <div>
            <span className="font-bold text-gray-800 text-sm block group-hover:text-emerald-700 transition-colors">Novo Documento Fiscal</span>
            <p className="text-[11px] text-gray-400 leading-normal">Compra, venda, serviço tomado ou prestado</p>
          </div>
        </Link>
        <Link href="/fiscal/documentos" className="p-4 border border-gray-150 hover:border-emerald-500 rounded-lg group transition-all flex items-start gap-3 bg-white">
          <ListChecks className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors mt-0.5" />
          <div>
            <span className="font-bold text-gray-800 text-sm block group-hover:text-emerald-700 transition-colors">Todos os Documentos</span>
            <p className="text-[11px] text-gray-400 leading-normal">Listar, validar, escriturar, contabilizar</p>
          </div>
        </Link>
        <Link href="/fiscal/apuracoes" className="p-4 border border-gray-150 hover:border-emerald-500 rounded-lg group transition-all flex items-start gap-3 bg-white">
          <FileStack className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors mt-0.5" />
          <div>
            <span className="font-bold text-gray-800 text-sm block group-hover:text-emerald-700 transition-colors">Apurações</span>
            <p className="text-[11px] text-gray-400 leading-normal">Calcular, revisar e fechar tributos</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
