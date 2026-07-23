'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FixedAsset } from '../types'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { disposeFixedAssetAction } from '../actions'
import { AlertCircle, CheckCircle, Ban } from 'lucide-react'
import { formatCurrencyBRL } from '../utils'

export function FixedAssetDisposeForm({ asset, chartAccounts }: { asset: FixedAsset; chartAccounts: ChartAccount[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [show, setShow] = useState(false)
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().substring(0, 10))
  const [disposalAmount, setDisposalAmount] = useState<number | undefined>(undefined)
  const [disposalCounterpartAccountId, setDisposalCounterpartAccountId] = useState('')
  const [disposalReason, setDisposalReason] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const eligibleAccounts = chartAccounts.filter((account) => account.accepts_entries && !account.is_synthetic && account.is_active)
  const netBookValue = Number(asset.net_book_value ?? asset.acquisition_amount) || 0
  const disposalProceeds = disposalAmount ?? 0
  const estimatedGain = Math.max(0, disposalProceeds - netBookValue)
  const estimatedLoss = Math.max(0, netBookValue - disposalProceeds)
  const needsCounterpart = disposalProceeds > 0

  if (asset.status === 'DISPOSED' || asset.status === 'SOLD') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500">
        Bem baixado em {asset.disposal_date}. Lançamento: {asset.disposal_journal_entry_id || '—'}. {asset.disposal_reason}
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await disposeFixedAssetAction({ id: asset.id, disposalDate, disposalAmount, disposalCounterpartAccountId, disposalReason })
      if (res.ok) {
        setSuccessMsg(res.message || 'Bem baixado.')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg cursor-pointer">
        <Ban className="w-3.5 h-3.5" />
        Baixar Bem
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Baixar Bem Patrimonial</h3>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-gray-400 block mb-1">Data da Baixa</label>
          <input type="date" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} required />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 block mb-1">Valor de Venda/Baixa</label>
          <input type="number" step="0.01" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs" value={disposalAmount ?? ''} onChange={(e) => setDisposalAmount(e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 block mb-1">Conta de Entrada/Recebível {needsCounterpart ? '*' : ''}</label>
          <select className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs" value={disposalCounterpartAccountId} onChange={(e) => setDisposalCounterpartAccountId(e.target.value)} required={needsCounterpart}>
            <option value="">— Nenhuma —</option>
            {eligibleAccounts.map((account) => (
              <option key={account.id} value={account.id}>{account.code} — {account.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="text-[10px] text-gray-400 block mb-1">Motivo *</label>
          <input className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs" value={disposalReason} onChange={(e) => setDisposalReason(e.target.value)} required />
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block mb-1">Valor Líquido</span>
          <span className="block px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700">{formatCurrencyBRL(netBookValue)}</span>
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block mb-1">{estimatedGain > 0 ? 'Ganho Estimado' : 'Perda Estimada'}</span>
          <span className={`block px-2.5 py-1.5 border rounded-lg text-xs font-mono ${estimatedGain > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            {formatCurrencyBRL(estimatedGain > 0 ? estimatedGain : estimatedLoss)}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setShow(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-600 cursor-pointer">Cancelar</button>
        <button type="submit" disabled={isPending || !disposalReason.trim() || (needsCounterpart && !disposalCounterpartAccountId)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
          Confirmar Baixa
        </button>
      </div>
    </form>
  )
}
