'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Check, Plus, X, ClipboardList } from 'lucide-react'
import { FiscalDocumentItemReviewIssue } from '../types'
import { linkReviewIssueToItemAction, createItemAndResolveReviewIssueAction, ignoreReviewIssueAction } from '../actions'
import type { ItemOption } from '@/modules/registrations/items/queries'

interface ReviewIssuesQueueProps {
  issues: FiscalDocumentItemReviewIssue[]
  items: ItemOption[]
}

const inputClass = 'px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500'

function formatCurrencyBRL(n: number | string | null | undefined): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (num === null || num === undefined || isNaN(num)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

function IssueRow({ issue, items }: { issue: FiscalDocumentItemReviewIssue; items: ItemOption[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedItemId, setSelectedItemId] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState(issue.fiscal_document_item?.description || '')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function handleLink() {
    if (!selectedItemId) return
    setErrorMsg(null)
    startTransition(async () => {
      const res = await linkReviewIssueToItemAction({ issueId: issue.id, itemId: selectedItemId })
      if (res.ok) router.refresh()
      else setErrorMsg(res.error)
    })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const res = await createItemAndResolveReviewIssueAction({
        issueId: issue.id,
        code: newCode,
        name: newName,
        itemType: 'PRODUCT',
        unit: issue.fiscal_document_item?.unit || '',
        ncm: issue.fiscal_document_item?.ncm || ''
      })
      if (res.ok) router.refresh()
      else setErrorMsg(res.error)
    })
  }

  function handleIgnore() {
    if (!window.confirm('Ignorar esta pendência? O item continuará sem produto vinculado.')) return
    setErrorMsg(null)
    startTransition(async () => {
      const res = await ignoreReviewIssueAction({ issueId: issue.id })
      if (res.ok) router.refresh()
      else setErrorMsg(res.error)
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-3 h-3" />
              Sem produto vinculado
            </span>
            {issue.fiscal_document?.number && (
              <Link href={`/fiscal/documentos/${issue.fiscal_document.id}`} className="text-xs font-semibold text-emerald-700 hover:underline">
                Documento nº {issue.fiscal_document.number}
              </Link>
            )}
            {issue.partner?.name && <span className="text-xs text-gray-400">· {issue.partner.name}</span>}
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-1">{issue.fiscal_document_item?.description}</p>
          <p className="text-xs text-gray-500">
            NCM: {issue.fiscal_document_item?.ncm || '—'} · Unidade: {issue.fiscal_document_item?.unit || '—'} · Valor: {formatCurrencyBRL(issue.fiscal_document_item?.total_amount)}
            {issue.details?.supplierProductCode && ` · Código do fornecedor: ${issue.details.supplierProductCode}`}
          </p>
        </div>
        <button onClick={handleIgnore} disabled={isPending} className="text-xs font-semibold text-gray-400 hover:text-red-600 cursor-pointer flex-shrink-0 inline-flex items-center gap-1">
          <X className="w-3.5 h-3.5" />
          Ignorar
        </button>
      </div>

      {errorMsg && <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded-lg text-xs font-semibold">{errorMsg}</div>}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <select className={inputClass} value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} disabled={isPending}>
          <option value="">— Selecione um produto do catálogo —</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.code} — {item.name}</option>
          ))}
        </select>
        <button
          onClick={handleLink}
          disabled={isPending || !selectedItemId}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          Vincular
        </button>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Criar produto novo
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 bg-gray-50 border border-gray-100 rounded-lg p-3">
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Código *</label>
            <input className={inputClass} value={newCode} onChange={(e) => setNewCode(e.target.value)} required />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] text-gray-400 block mb-0.5">Nome *</label>
            <input className={inputClass + ' w-full'} value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </div>
          <button type="submit" disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
            {isPending ? 'Criando...' : 'Criar e Vincular'}
          </button>
        </form>
      )}
    </div>
  )
}

export function ReviewIssuesQueue({ issues, items }: ReviewIssuesQueueProps) {
  if (issues.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <ClipboardList className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhuma pendência de classificação de item</span>
        <p className="text-xs text-gray-400 max-w-sm">Itens importados via XML sem vínculo forte com o catálogo aparecem aqui para revisão manual.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => (
        <IssueRow key={issue.id} issue={issue} items={items} />
      ))}
    </div>
  )
}
