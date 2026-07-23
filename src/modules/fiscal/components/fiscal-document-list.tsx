'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiscalDocument } from '../types'
import { FiscalDocumentCard } from './fiscal-document-card'
import { bulkFiscalDocumentAccountingAction, bulkFiscalDocumentWorkflowAction, bulkRegenerateFiscalDocumentAccountingAction } from '../actions'
import type { BulkFiscalDocumentWorkflowResult } from '../actions'
import { BookMarked, CheckCircle2, FileStack, ListChecks, Loader2, Search, X, Zap, RefreshCw } from 'lucide-react'

type BulkOperation = 'VALIDATE' | 'BOOK' | 'ACCOUNT' | 'REGENERATE'

const OPERATION_VERBING: Record<BulkOperation, string> = {
  VALIDATE: 'Validando',
  BOOK: 'Escriturando',
  ACCOUNT: 'Contabilizando',
  REGENERATE: 'Regerando'
}

interface FiscalDocumentListProps {
  documents: FiscalDocument[]
}

export function FiscalDocumentList({ documents }: FiscalDocumentListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [direction, setDirection] = useState(searchParams.get('direction') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [text, setText] = useState(searchParams.get('text') || '')
  const [hasPendencies, setHasPendencies] = useState(searchParams.get('hasPendencies') === '1')
  const [notAccountedFilter, setNotAccountedFilter] = useState(searchParams.get('notAccounted') === '1')
  const [notAssessedFilter, setNotAssessedFilter] = useState(searchParams.get('notAssessed') === '1')
  const [noProductFilter, setNoProductFilter] = useState(searchParams.get('noProduct') === '1')
  const [hasXmlWarningsFilter, setHasXmlWarningsFilter] = useState(searchParams.get('hasXmlWarnings') === '1')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkResult, setBulkResult] = useState<BulkFiscalDocumentWorkflowResult | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [pendingOperation, setPendingOperation] = useState<BulkOperation | null>(null)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    if (!showToast) return
    const timer = setTimeout(() => setShowToast(false), 6000)
    return () => clearTimeout(timer)
  }, [showToast])

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault()
    const params = new URLSearchParams()
    if (direction) params.set('direction', direction)
    if (status) params.set('status', status)
    if (text) params.set('text', text)
    if (hasPendencies) params.set('hasPendencies', '1')
    if (notAccountedFilter) params.set('notAccounted', '1')
    if (notAssessedFilter) params.set('notAssessed', '1')
    if (noProductFilter) params.set('noProduct', '1')
    if (hasXmlWarningsFilter) params.set('hasXmlWarnings', '1')
    setSelection([])
    setBulkResult(null)
    router.push(`/fiscal/documentos?${params.toString()}`)
  }

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const filteredIds = useMemo(() => documents.map((doc) => doc.id), [documents])
  const selectedFilteredCount = useMemo(() => filteredIds.filter((id) => selectedSet.has(id)).length, [filteredIds, selectedSet])
  const allFilteredSelected = filteredIds.length > 0 && selectedFilteredCount === filteredIds.length
  const validatableIds = documents.filter((doc) => doc.status === 'DRAFT' || doc.status === 'IMPORTED').map((doc) => doc.id)
  const bookableIds = documents.filter((doc) => doc.status === 'VALIDATED').map((doc) => doc.id)
  const accountableIds = documents.filter((doc) => doc.status === 'BOOKED' && doc.accounting_status !== 'ACCOUNTED').map((doc) => doc.id)
  const regenerableIds = documents.filter((doc) => doc.accounting_status === 'ACCOUNTED').map((doc) => doc.id)
  const duplicatedIds = documents.filter((doc) => (doc.active_accounting_application_count || 0) > 1).map((doc) => doc.id)

  function setSelection(ids: string[]) {
    setSelectedIds(Array.from(new Set(ids)))
    setBulkError(null)
  }

  function toggleDocument(id: string, selected: boolean) {
    setSelection(selected ? [...selectedIds, id] : selectedIds.filter((selectedId) => selectedId !== id))
  }

  function toggleAllFiltered(selected: boolean) {
    setSelection(selected ? filteredIds : [])
  }

  function handleBulk(operation: BulkOperation) {
    setBulkError(null)
    setBulkResult(null)
    setShowToast(false)
    const selectedCount = selectedIds.length
    if (selectedCount === 0) {
      setBulkError('Selecione pelo menos um documento.')
      return
    }

    if (operation === 'BOOK' && !window.confirm(`Escriturar ${selectedCount} documento(s) selecionado(s)?`)) return
    if (operation === 'ACCOUNT' && !window.confirm(`Gerar a contabilidade de ${selectedCount} documento(s) selecionado(s) usando as regras contábeis fiscais?`)) return
    if (operation === 'REGENERATE' && !window.confirm(`Estornar e recontabilizar ${selectedCount} documento(s) selecionado(s) usando as regras contábeis fiscais? Isso cria um lançamento de estorno para cada um e um novo lançamento em seguida.`)) return

    setPendingOperation(operation)
    startTransition(async () => {
      const res = operation === 'ACCOUNT'
        ? await bulkFiscalDocumentAccountingAction({ ids: selectedIds })
        : operation === 'REGENERATE'
          ? await bulkRegenerateFiscalDocumentAccountingAction({ ids: selectedIds })
          : await bulkFiscalDocumentWorkflowAction({ ids: selectedIds, operation })

      setPendingOperation(null)
      if (res.ok) {
        setBulkResult(res.data)
        setSelectedIds([])
        setShowToast(true)
        router.refresh()
      } else {
        setBulkError(res.error)
      }
    })
  }

  const inputClass = 'px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
  const secondaryButtonClass = 'inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-300 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

  return (
    <div className="space-y-4">
      <form onSubmit={applyFilters} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Direção</label>
          <select className={inputClass} value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="">Todas</option>
            <option value="IN">Entrada</option>
            <option value="OUT">Saída</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Status</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="DRAFT">Rascunho</option>
            <option value="IMPORTED">Importado</option>
            <option value="VALIDATED">Validado</option>
            <option value="BOOKED">Escriturado</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Buscar número/observação</label>
          <input className={inputClass + ' w-full'} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer">
          <Search className="w-3.5 h-3.5" />
          Filtrar
        </button>

        <div className="w-full flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          {([
            ['Com pendências', hasPendencies, setHasPendencies],
            ['Não contabilizados', notAccountedFilter, setNotAccountedFilter],
            ['Não apurados', notAssessedFilter, setNotAssessedFilter],
            ['Sem produto vinculado', noProductFilter, setNoProductFilter],
            ['Com warnings XML', hasXmlWarningsFilter, setHasXmlWarningsFilter]
          ] as [string, boolean, (v: boolean) => void][]).map(([label, checked, setChecked]) => (
            <label key={label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold cursor-pointer select-none transition-colors ${checked ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              <input type="checkbox" className="hidden" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
              <ListChecks className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800">Ações em lote</p>
              <p className="text-xs text-gray-400">
                {selectedIds.length} selecionado(s) · {selectedFilteredCount}/{documents.length} do filtro · {validatableIds.length} validável(is) · {bookableIds.length} escriturável(is) · {accountableIds.length} contabilizável(is) · {regenerableIds.length} regerável(is)
                {duplicatedIds.length > 0 && <span className="text-red-600 font-semibold"> · {duplicatedIds.length} com contabilização duplicada</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                checked={allFilteredSelected}
                onChange={(e) => toggleAllFiltered(e.target.checked)}
                disabled={isPending || documents.length === 0}
              />
              Todos do filtro ({documents.length})
            </label>
            <button type="button" onClick={() => setSelection(validatableIds)} disabled={isPending || validatableIds.length === 0} className={secondaryButtonClass}>
              Selecionar validáveis do filtro
            </button>
            <button type="button" onClick={() => setSelection(bookableIds)} disabled={isPending || bookableIds.length === 0} className={secondaryButtonClass}>
              Selecionar escrituráveis do filtro
            </button>
            <button type="button" onClick={() => setSelection(accountableIds)} disabled={isPending || accountableIds.length === 0} className={secondaryButtonClass}>
              Selecionar contabilizáveis do filtro
            </button>
            <button type="button" onClick={() => setSelection(regenerableIds)} disabled={isPending || regenerableIds.length === 0} className={secondaryButtonClass}>
              Selecionar regeráveis do filtro
            </button>
            {duplicatedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelection(duplicatedIds)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Selecionar duplicados ({duplicatedIds.length})
              </button>
            )}
            <button type="button" onClick={() => setSelection([])} disabled={isPending || selectedIds.length === 0} className={secondaryButtonClass}>
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
            <button type="button" onClick={() => handleBulk('VALIDATE')} disabled={isPending || selectedIds.length === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {pendingOperation === 'VALIDATE' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {pendingOperation === 'VALIDATE' ? OPERATION_VERBING.VALIDATE + '...' : 'Validar'}
            </button>
            <button type="button" onClick={() => handleBulk('BOOK')} disabled={isPending || selectedIds.length === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {pendingOperation === 'BOOK' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookMarked className="w-3.5 h-3.5" />}
              {pendingOperation === 'BOOK' ? OPERATION_VERBING.BOOK + '...' : 'Escriturar'}
            </button>
            <button type="button" onClick={() => handleBulk('ACCOUNT')} disabled={isPending || selectedIds.length === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {pendingOperation === 'ACCOUNT' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {pendingOperation === 'ACCOUNT' ? OPERATION_VERBING.ACCOUNT + '...' : 'Contabilizar'}
            </button>
            <button type="button" onClick={() => handleBulk('REGENERATE')} disabled={isPending || selectedIds.length === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {pendingOperation === 'REGENERATE' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {pendingOperation === 'REGENERATE' ? OPERATION_VERBING.REGENERATE + '...' : 'Regerar'}
            </button>
          </div>
        </div>

        {pendingOperation && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
            {OPERATION_VERBING[pendingOperation]} {selectedIds.length || ''} documento(s)... aguarde, isso pode levar alguns segundos.
          </div>
        )}

        {bulkError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
            {bulkError}
          </div>
        )}

        {bulkResult && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <p className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {bulkResult.succeeded} de {bulkResult.requested} documento(s) processado(s).
            </p>
            {bulkResult.failed.length > 0 && (
              <div className="mt-1 text-amber-900">
                {bulkResult.failed.slice(0, 5).map((failure) => (
                  <p key={failure.id}>{failure.label}: {failure.reason}</p>
                ))}
                {bulkResult.failed.length > 5 && <p>+ {bulkResult.failed.length - 5} ocorrência(s)</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {showToast && bulkResult && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full rounded-xl border border-emerald-200 bg-white shadow-lg p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-800">Concluído!</p>
            <p className="text-xs text-gray-500">
              {bulkResult.succeeded} de {bulkResult.requested} documento(s) processado(s) com sucesso.
              {bulkResult.failed.length > 0 && ` ${bulkResult.failed.length} com pendência — veja detalhes abaixo.`}
            </p>
          </div>
          <button type="button" onClick={() => setShowToast(false)} className="text-gray-300 hover:text-gray-500 cursor-pointer flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
          <FileStack className="w-8 h-8 text-gray-300" />
          <span className="text-sm font-semibold text-gray-600">Nenhum documento fiscal encontrado</span>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <FiscalDocumentCard key={doc.id} doc={doc} selectable selected={selectedSet.has(doc.id)} onSelectedChange={(selected) => toggleDocument(doc.id, selected)} />
          ))}
        </div>
      )}
    </div>
  )
}
