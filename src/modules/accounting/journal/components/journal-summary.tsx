'use client'

import React from 'react'
import { formatCurrencyBRL } from '../journal-utils'
import { 
  ClipboardList, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react'

interface JournalSummaryProps {
  totalCount: number
  totalDebits: number
  totalCredits: number
}

export function JournalSummary({ totalCount, totalDebits, totalCredits }: JournalSummaryProps) {
  const difference = totalDebits - totalCredits
  const isBalanced = Math.abs(difference) < 0.01

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          Resumo Contábil da Competência
        </h3>
        {isBalanced ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Lançamentos Equilibrados
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" /> Desequilíbrio Detectado
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Quantidade */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-50 text-gray-500 rounded-lg">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Lançamentos</span>
            <div className="text-base font-bold text-gray-800">{totalCount}</div>
          </div>
        </div>

        {/* Débitos */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <ArrowUpCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Débito</span>
            <div className="text-base font-bold text-blue-700">{formatCurrencyBRL(totalDebits)}</div>
          </div>
        </div>

        {/* Créditos */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <ArrowDownCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Crédito</span>
            <div className="text-base font-bold text-amber-700">{formatCurrencyBRL(totalCredits)}</div>
          </div>
        </div>

        {/* Diferença */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isBalanced ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Diferença (D - C)</span>
            <div className={`text-base font-bold ${isBalanced ? 'text-gray-800' : 'text-red-700'}`}>
              {formatCurrencyBRL(difference)}
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Desequilíbrio se houver */}
      {!isBalanced && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            A soma total dos débitos diverge da soma dos créditos nesta competência por **{formatCurrencyBRL(Math.abs(difference))}**. 
            Isso indica que há lançamentos individuais desequilibrados ou inconsistências no banco que exigem correção.
          </p>
        </div>
      )}
    </div>
  )
}
