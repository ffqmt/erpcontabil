'use client'

import React, { useState } from 'react'
import { ClosingPreviewItem } from '../types'
import { formatCurrencyBRL } from '../closing-utils'
import { Info, HelpCircle } from 'lucide-react'

interface ClosingPreviewTableProps {
  items: ClosingPreviewItem[]
  targetAccountName?: string
  netResult: number
}

export function ClosingPreviewTable({
  items,
  targetAccountName,
  netResult
}: ClosingPreviewTableProps) {
  const [showSynthetic, setShowSynthetic] = useState(true)

  const isProfit = netResult >= 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50/30 flex items-center justify-between">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Detalhamento das Pernas de Zeramento</h4>
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Prévia do Diário de Encerramento</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse border-spacing-0">
          <thead>
            <tr className="bg-gray-150/40 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3.5 w-32">Código</th>
              <th className="px-4 py-3.5">Conta de Resultado</th>
              <th className="px-4 py-3.5 text-center w-28">Tipo</th>
              <th className="px-4 py-3.5 text-right w-44">Saldo Antes</th>
              <th className="px-4 py-3.5 text-right w-36">Débito Zeramento</th>
              <th className="px-4 py-3.5 text-right w-36">Crédito Zeramento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white text-xs text-gray-650">
            {/* Linhas das contas contábeis encerradas */}
            {items.map((item) => {
              const { id, code, name, account_type, signedAmount, debitAmount, creditAmount } = item
              return (
                <tr key={id} className="hover:bg-gray-50/30 border-b border-gray-100 font-mono">
                  <td className="px-4 py-3 text-gray-800 font-bold">{code}</td>
                  <td className="px-4 py-3 font-sans text-gray-750 font-medium">{name}</td>
                  <td className="px-4 py-3 text-center text-gray-400 font-sans text-[10px] uppercase font-bold">
                    {account_type}
                  </td>
                  <td className={`px-4 py-3 text-right ${signedAmount < 0 ? 'text-amber-800' : 'text-cyan-850'}`}>
                    {formatCurrencyBRL(signedAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-cyan-800 font-semibold">
                    {debitAmount > 0 ? formatCurrencyBRL(debitAmount) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-800 font-semibold">
                    {creditAmount > 0 ? formatCurrencyBRL(creditAmount) : '-'}
                  </td>
                </tr>
              )
            })}

            {/* Linha líquida de PL para contrapartida de equilíbrio */}
            {Math.abs(netResult) > 0.009 && (
              <tr className="bg-emerald-50/15 font-mono font-bold text-gray-800 border-t-2 border-gray-200">
                <td className="px-4 py-4 text-emerald-800">PL destino</td>
                <td className="px-4 py-4 font-sans text-gray-900">
                  <div className="flex flex-col gap-0.5">
                    <span>{targetAccountName || 'Conta do PL Destino'}</span>
                    <span className="text-[10px] text-gray-400 font-normal font-sans">
                      Contrapartida de transferência líquida ({isProfit ? 'Lucro' : 'Prejuízo'})
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center font-sans text-[10px] uppercase">EQUITY</td>
                <td className="px-4 py-4 text-right text-gray-400 font-normal">-</td>
                <td className="px-4 py-4 text-right text-cyan-800">
                  {!isProfit ? formatCurrencyBRL(Math.abs(netResult)) : '-'}
                </td>
                <td className="px-4 py-4 text-right text-amber-800">
                  {isProfit ? formatCurrencyBRL(netResult) : '-'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
