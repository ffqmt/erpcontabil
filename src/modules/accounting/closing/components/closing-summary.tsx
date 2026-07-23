'use client'

import React from 'react'
import { formatCurrencyBRL } from '../closing-utils'
import { Landmark, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react'

interface ClosingSummaryProps {
  totalRevenue: number
  totalDeductions: number
  totalCosts: number
  totalExpenses: number
  netResult: number
}

export function ClosingSummary({
  totalRevenue,
  totalDeductions,
  totalCosts,
  totalExpenses,
  netResult
}: ClosingSummaryProps) {
  const isProfit = netResult >= 0
  const totalOutflows = totalDeductions + totalCosts + totalExpenses

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm space-y-6">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
        <Landmark className="w-4 h-4 text-gray-400" />
        Apuração do Resultado do Período
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Receita Bruta */}
        <div className="bg-gray-50 border border-gray-150 p-4 rounded-lg space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Receita Bruta (+)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-gray-800">{formatCurrencyBRL(totalRevenue)}</span>
            <ArrowUpRight className="w-4 h-4 text-green-600" />
          </div>
        </div>

        {/* Deduções e Custos */}
        <div className="bg-gray-50 border border-gray-150 p-4 rounded-lg space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Deduções & Custos (-)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-gray-850">{formatCurrencyBRL(totalDeductions + totalCosts)}</span>
            <ArrowDownRight className="w-4 h-4 text-red-650" />
          </div>
        </div>

        {/* Despesas Operacionais */}
        <div className="bg-gray-50 border border-gray-150 p-4 rounded-lg space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Despesas Operacionais (-)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-gray-850">{formatCurrencyBRL(totalExpenses)}</span>
            <ArrowDownRight className="w-4 h-4 text-red-650" />
          </div>
        </div>

        {/* Resultado Líquido */}
        <div className={`p-4 rounded-lg border space-y-1 ${
          isProfit 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
            {isProfit ? 'Lucro Líquido do Mês (=)' : 'Prejuízo Líquido do Mês (=)'}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-black">{formatCurrencyBRL(Math.abs(netResult))}</span>
            {isProfit ? (
              <TrendingUp className="w-5 h-5 text-green-700" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-700" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
