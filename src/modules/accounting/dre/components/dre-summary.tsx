'use client'

import React from 'react'
import { formatCurrencyBRL, formatPercentage } from '../dre-utils'
import { 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Percent, 
  DollarSign 
} from 'lucide-react'

interface DreSummaryProps {
  grossRevenue: number
  netRevenue: number
  grossProfit: number
  expensesTotal: number
  netProfit: number
  netMargin: number
}

export function DreSummary({
  grossRevenue,
  netRevenue,
  grossProfit,
  expensesTotal,
  netProfit,
  netMargin
}: DreSummaryProps) {
  const isProfit = netProfit >= 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
      {/* Receita Bruta */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
          <Coins className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Receita Bruta</span>
          <span className="text-sm font-bold text-gray-800 font-mono">
            {formatCurrencyBRL(grossRevenue)}
          </span>
        </div>
      </div>

      {/* Receita Líquida */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
          <Coins className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Receita Líquida</span>
          <span className="text-sm font-bold text-indigo-700 font-mono">
            {formatCurrencyBRL(netRevenue)}
          </span>
        </div>
      </div>

      {/* Lucro Bruto */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
          <Coins className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Lucro Bruto</span>
          <span className="text-sm font-bold text-cyan-700 font-mono">
            {formatCurrencyBRL(grossProfit)}
          </span>
        </div>
      </div>

      {/* Despesas Operacionais */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
          <TrendingDown className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Despesas Oper.</span>
          <span className="text-sm font-bold text-rose-700 font-mono">
            {formatCurrencyBRL(expensesTotal, true)}
          </span>
        </div>
      </div>

      {/* Lucro Líquido */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isProfit ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-650'}`}>
          {isProfit ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Lucro Líquido</span>
          <span className={`text-sm font-bold font-mono ${isProfit ? 'text-green-700' : 'text-red-750'}`}>
            {formatCurrencyBRL(netProfit, true)}
          </span>
        </div>
      </div>

      {/* Margem Líquida */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
          <Percent className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Margem Líquida</span>
          <span className="text-sm font-bold text-emerald-700 font-mono">
            {formatPercentage(netMargin)}
          </span>
        </div>
      </div>
    </div>
  )
}
