'use client'

import React from 'react'
import { formatCurrencyBRL } from '../balance-sheet-utils'
import { 
  Scale, 
  ShieldCheck, 
  AlertTriangle,
  Coins,
  DollarSign
} from 'lucide-react'

interface BalanceSheetSummaryProps {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  netPeriodResult: number
  totalLiabilitiesAndEquity: number
  difference: number
  isBalanced: boolean
}

export function BalanceSheetSummary({
  totalAssets,
  totalLiabilities,
  totalEquity,
  netPeriodResult,
  totalLiabilitiesAndEquity,
  difference,
  isBalanced
}: BalanceSheetSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Alertas de Equilíbrio Patrimonial */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-600" />
          Igualdade Patrimonial (Ativo = Passivo + PL)
        </h3>
        <div>
          {isBalanced ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-600 text-white shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5" /> Balanço Fechado (Diferença: R$ 0,00)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-600 text-white animate-pulse shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5" /> Diferença: {formatCurrencyBRL(difference)}
            </span>
          )}
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Ativo Total */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Ativo Total</span>
            <span className="text-sm font-bold text-blue-700 font-mono">
              {formatCurrencyBRL(totalAssets)}
            </span>
          </div>
        </div>

        {/* Passivo Total */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Passivo Total</span>
            <span className="text-sm font-bold text-orange-700 font-mono">
              {formatCurrencyBRL(totalLiabilities)}
            </span>
          </div>
        </div>

        {/* Patrimônio Líquido */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Patrimônio Líquido</span>
            <span className="text-sm font-bold text-purple-700 font-mono">
              {formatCurrencyBRL(totalEquity)}
            </span>
          </div>
        </div>

        {/* Resultado do Período */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className={`p-2 rounded-lg ${netPeriodResult >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Resultado Período</span>
            <span className={`text-sm font-bold font-mono ${netPeriodResult >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrencyBRL(netPeriodResult, true)}
            </span>
          </div>
        </div>

        {/* Passivo + PL */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 col-span-2 lg:col-span-1">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Passivo + PL</span>
            <span className="text-sm font-bold text-indigo-700 font-mono">
              {formatCurrencyBRL(totalLiabilitiesAndEquity)}
            </span>
          </div>
        </div>
      </div>

      {/* Alerta de Desequilíbrio */}
      {!isBalanced && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 flex gap-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <div>
            <strong className="font-semibold block mb-0.5">Divergência Patrimonial Crítica</strong>
            <p className="leading-relaxed">
              O total do Ativo difere do total do Passivo + PL por **{formatCurrencyBRL(difference)}**. 
              Verifique a consistência dos saldos de abertura e os lançamentos manuais do período para auditar a igualdade.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
