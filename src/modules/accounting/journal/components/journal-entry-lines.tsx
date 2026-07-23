import React from 'react'
import { JournalEntryLine } from '../types'
import { formatCurrencyBRL } from '../journal-utils'

interface JournalEntryLinesProps {
  lines: JournalEntryLine[]
}

export function JournalEntryLines({ lines }: JournalEntryLinesProps) {
  return (
    <div className="overflow-x-auto border border-gray-100 rounded-lg bg-gray-50/20">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-2">Conta Contábil</th>
            <th className="px-4 py-2">Centro de Custo</th>
            <th className="px-4 py-2">Histórico Linha</th>
            <th className="px-4 py-2 text-right w-36">Débito</th>
            <th className="px-4 py-2 text-right w-36">Crédito</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 font-sans">
          {lines.map((line) => {
            const isDebit = line.debit_credit === 'DEBIT'
            const accCode = line.account?.code || '—'
            const accName = line.account?.name || 'Conta não encontrada'

            return (
              <tr key={line.id} className="hover:bg-gray-50/40 text-gray-600">
                {/* Conta Contábil (Indentação clássica para crédito) */}
                <td className="px-4 py-2.5">
                  <div className={`flex flex-col ${!isDebit ? 'pl-8' : ''}`}>
                    <span className="font-mono font-medium text-gray-800 text-[11px]">
                      {accCode}
                    </span>
                    <span className="text-gray-500 text-xs mt-0.5">
                      {!isDebit && <span className="text-amber-600 mr-1 font-bold">a</span>}
                      {accName}
                    </span>
                  </div>
                </td>

                {/* Centro de Custo */}
                <td className="px-4 py-2.5 text-gray-500 italic">
                  {line.cost_center ? (
                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
                      {line.cost_center.code} - {line.cost_center.name}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>

                {/* Histórico Complementar */}
                <td className="px-4 py-2.5 truncate max-w-xs text-gray-500" title={line.memo || ''}>
                  {line.memo || '—'}
                </td>

                {/* Débito */}
                <td className="px-4 py-2.5 text-right font-mono font-medium text-blue-700">
                  {isDebit ? formatCurrencyBRL(line.amount) : ''}
                </td>

                {/* Crédito */}
                <td className="px-4 py-2.5 text-right font-mono font-medium text-amber-700">
                  {!isDebit ? formatCurrencyBRL(line.amount) : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
