'use client'

import React from 'react'
import { formatCurrencyBRL } from '../trial-balance-utils'
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Calculator, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react'

interface TrialBalanceSummaryProps {
  periodDebits: number
  periodCredits: number
  finalDebits: number
  finalCredits: number
  activeCount: number
}

export function TrialBalanceSummary({
  periodDebits,
  periodCredits,
  finalDebits,
  finalCredits,
  activeCount
}: TrialBalanceSummaryProps) {
  const periodDifference = Math.abs(periodDebits - periodCredits)
  const finalDifference = Math.abs(finalDebits - finalCredits)
  
  const isPeriodBalanced = periodDifference < 0.01
  const isFinalBalanced = finalDifference < 0.01

  return (
    <div className="space-y-4">
      {/* Alertas de Fechamento */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-emerald-600" />
          Auditoria de Fechamento
        </h3>
        <div className="flex gap-2">
          {isPeriodBalanced ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Movimento Equilibrado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" /> Desequilíbrio no Movimento
            </span>
          )}

          {isFinalBalanced ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-600 text-white border border-green-700 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" /> Balancete Fechado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-600 text-white border border-red-750 animate-pulse shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5" /> Diferença no Balancete
            </span>
          )}
        </div>
      </div>

      {/* Cards Estatísticos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Débitos Período */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Débitos do Período</span>
            <span className="text-sm font-bold text-blue-700 font-mono">
              {formatCurrencyBRL(periodDebits)}
            </span>
          </div>
        </div>

        {/* Total Créditos Período */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <ArrowDownRight className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Créditos do Período</span>
            <span className="text-sm font-bold text-amber-700 font-mono">
              {formatCurrencyBRL(periodCredits)}
            </span>
          </div>
        </div>

        {/* Total Devedor Final */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Saldo Final Devedor</span>
            <span className="text-sm font-bold text-cyan-700 font-mono">
              {formatCurrencyBRL(finalDebits)}
            </span>
          </div>
        </div>

        {/* Total Credor Final */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
            <ArrowDownRight className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Saldo Final Credor</span>
            <span className="text-sm font-bold text-orange-700 font-mono">
              {formatCurrencyBRL(finalCredits)}
            </span>
          </div>
        </div>

        {/* Diferença do Balancete */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 col-span-2 lg:col-span-1">
          <div className={`p-2 rounded-lg ${isFinalBalanced ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Diferença Balancete</span>
            <span className={`text-sm font-bold font-mono ${isFinalBalanced ? 'text-gray-800' : 'text-red-700'}`}>
              {formatCurrencyBRL(finalDifference)}
            </span>
          </div>
        </div>
      </div>

      {/* Alerta de Erros Críticos */}
      {(!isPeriodBalanced || !isFinalBalanced) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 flex gap-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <div>
            <strong className="font-semibold block mb-0.5">Divergência Contábil Detectada</strong>
            {!isPeriodBalanced && (
              <p className="leading-relaxed">
                * As movimentações de Débito e Crédito do período diferem em **{formatCurrencyBRL(periodDifference)}**.
              </p>
            )}
            {!isFinalBalanced && (
              <p className="leading-relaxed">
                * Os saldos acumulados devedores e credores divergem em **{formatCurrencyBRL(finalDifference)}**.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
