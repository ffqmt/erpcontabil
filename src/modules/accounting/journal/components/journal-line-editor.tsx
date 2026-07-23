'use client'

import React from 'react'
import { ChartAccount } from '../../accounts/types'
import { AccountSelect } from './account-select'
import { Trash2, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatCurrencyBRL } from '../journal-utils'

export interface EditableJournalLine {
  id: string
  accountId: string
  debitCredit: 'DEBIT' | 'CREDIT'
  amount: number
  memo: string
}

interface JournalLineEditorProps {
  accounts: ChartAccount[]
  lines: EditableJournalLine[]
  onChange: (lines: EditableJournalLine[]) => void
}

export function JournalLineEditor({ accounts, lines, onChange }: JournalLineEditorProps) {
  
  const handleLineChange = (index: number, field: keyof EditableJournalLine, value: any) => {
    const updated = [...lines]
    updated[index] = {
      ...updated[index],
      [field]: value
    }
    onChange(updated)
  }

  const handleAddLine = () => {
    const defaultDebitCredit = lines.length > 0 && lines[lines.length - 1].debitCredit === 'DEBIT' 
      ? 'CREDIT' 
      : 'DEBIT'
      
    onChange([
      ...lines,
      {
        id: crypto.randomUUID(),
        accountId: '',
        debitCredit: defaultDebitCredit,
        amount: 0,
        memo: ''
      }
    ])
  }

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return // Mantém o mínimo contábil de duas pernas
    const updated = lines.filter((_, idx) => idx !== index)
    onChange(updated)
  }

  // Cálculos matemáticos em tempo real
  const summary = React.useMemo(() => {
    let debits = 0
    let credits = 0
    lines.forEach((line) => {
      const val = parseFloat(line.amount as any) || 0
      if (line.debitCredit === 'DEBIT') {
        debits += val
      } else {
        credits += val
      }
    })

    const difference = Math.abs(debits - credits)
    const isBalanced = difference < 0.01 && lines.length >= 2

    return {
      debits,
      credits,
      difference,
      isBalanced
    }
  }, [lines])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase font-bold text-gray-500 tracking-wider">Pernas Contábeis (Múltiplas Partidas)</h4>
        <button
          type="button"
          onClick={handleAddLine}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar Linha
        </button>
      </div>

      {/* Tabela de Inserção de Linhas */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
              <th className="px-4 py-3">Conta Contábil</th>
              <th className="px-4 py-3 w-40">Tipo</th>
              <th className="px-4 py-3 w-44">Valor (R$)</th>
              <th className="px-4 py-3">Histórico / Memo Complementar</th>
              <th className="px-4 py-3 w-16 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150">
            {lines.map((line, index) => (
              <tr key={line.id} className="hover:bg-gray-50/30">
                {/* Seleção de Conta */}
                <td className="px-4 py-3">
                  <AccountSelect
                    accounts={accounts}
                    value={line.accountId}
                    onChange={(val) => handleLineChange(index, 'accountId', val)}
                  />
                </td>

                {/* Tipo de Pernas (D ou C) */}
                <td className="px-4 py-3">
                  <div className="flex border border-gray-200 rounded-lg overflow-hidden w-fit bg-gray-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleLineChange(index, 'debitCredit', 'DEBIT')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${
                        line.debitCredit === 'DEBIT'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <ArrowUpRight className="w-3 h-3" /> Débito
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLineChange(index, 'debitCredit', 'CREDIT')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${
                        line.debitCredit === 'CREDIT'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <ArrowDownRight className="w-3 h-3" /> Crédito
                    </button>
                  </div>
                </td>

                {/* Valor */}
                <td className="px-4 py-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={line.amount || ''}
                    onChange={(e) => handleLineChange(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-gray-800 bg-white"
                  />
                </td>

                {/* Memo */}
                <td className="px-4 py-3">
                  <input
                    type="text"
                    placeholder="Histórico da perna..."
                    value={line.memo}
                    onChange={(e) => handleLineChange(index, 'memo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-gray-700 bg-white"
                  />
                </td>

                {/* Ações */}
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(index)}
                    disabled={lines.length <= 2}
                    className="text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1.5 hover:bg-red-50 rounded transition-all"
                    title="Excluir Linha"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totalizadores de Pernas e Status */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6 text-xs text-gray-650">
          <div>
            Total Débitos: <span className="font-mono font-bold text-blue-700">{formatCurrencyBRL(summary.debits)}</span>
          </div>
          <div>
            Total Créditos: <span className="font-mono font-bold text-amber-700">{formatCurrencyBRL(summary.credits)}</span>
          </div>
          <div>
            Diferença: <span className={`font-mono font-bold ${summary.isBalanced ? 'text-gray-800' : 'text-red-600 animate-pulse'}`}>{formatCurrencyBRL(summary.difference)}</span>
          </div>
        </div>

        <div>
          {summary.isBalanced ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
              Lançamento Balanceado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
              Desequilibrado (D ≠ C)
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
