'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BankStatementLine } from '../types'
import { formatCurrencyBRL, formatDateBR } from '../utils'
import { ignoreBankStatementLineAction, unreconcileBankStatementLineAction } from '../actions'
import { BankStatementLineStatusBadge } from './bank-statement-line-status-badge'
import { ArrowDownToLine, ArrowUpFromLine, Tag, Ban, RotateCcw } from 'lucide-react'

interface BankStatementLineCardProps {
  line: BankStatementLine
}

export function BankStatementLineCard({ line }: BankStatementLineCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showIgnoreForm, setShowIgnoreForm] = useState(false)
  const [reason, setReason] = useState('')

  const amount = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
  const isInflow = amount > 0
  const Icon = isInflow ? ArrowDownToLine : ArrowUpFromLine

  function handleIgnore() {
    if (!reason.trim()) return
    startTransition(async () => {
      await ignoreBankStatementLineAction({ lineId: line.id, reason })
      setShowIgnoreForm(false)
      setReason('')
      router.refresh()
    })
  }

  function handleUnreconcile() {
    if (!window.confirm('Desfazer a conciliação desta linha? O lançamento contábil gerado NÃO será apagado — se precisar desfazê-lo também, estorne-o em Lançamentos.')) return
    startTransition(async () => {
      await unreconcileBankStatementLineAction({ lineId: line.id })
      router.refresh()
    })
  }

  const canClassify = line.status === 'PENDING' || line.status === 'CLASSIFIED'
  const canIgnore = line.status === 'PENDING' || line.status === 'CLASSIFIED' || line.status === 'ERROR'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-lg border flex-shrink-0 ${isInflow ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-mono">{formatDateBR(line.entry_date)}</span>
              <span className="font-semibold text-gray-800 text-sm truncate">{line.description}</span>
              <BankStatementLineStatusBadge status={line.status} />
            </div>
            <p className="text-[11px] text-gray-400">
              {line.document_number ? `Doc. ${line.document_number} · ` : ''}
              {line.bank_account?.bank_name || 'Conta bancária'}
              {line.counterparty_account ? ` · Contrapartida: ${line.counterparty_account.code} - ${line.counterparty_account.name}` : ''}
              {line.journal_entry_line?.journal_entry?.number ? ` · Lançamento nº ${line.journal_entry_line.journal_entry.number}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`font-mono font-bold text-sm ${isInflow ? 'text-green-700' : 'text-red-700'}`}>
            {formatCurrencyBRL(amount)}
          </span>
          <div className="flex items-center gap-2">
            {canClassify && (
              <Link
                href={`/bancos/conciliacao/${line.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
              >
                <Tag className="w-3.5 h-3.5" />
                Classificar
              </Link>
            )}
            {canIgnore && (
              <button
                onClick={() => setShowIgnoreForm((v) => !v)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                Ignorar
              </button>
            )}
            {line.status === 'RECONCILED' && (
              <button
                onClick={handleUnreconcile}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-200 text-amber-700 hover:bg-amber-50 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Desfazer
              </button>
            )}
          </div>
        </div>
      </div>

      {showIgnoreForm && (
        <div className="flex gap-2 items-center pt-2 border-t border-gray-100">
          <input
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
            placeholder="Justificativa para ignorar esta linha..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            onClick={handleIgnore}
            disabled={isPending || !reason.trim()}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  )
}
