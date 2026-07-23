'use client'

import React, { useTransition, useState, useMemo } from 'react'
import { JournalEntry } from '../types'
import { postJournalEntryAction, reverseJournalEntryAction } from '../actions'
import { JournalEntryCard } from './journal-entry-card'
import { JournalReversalDialog } from './journal-reversal-dialog'
import { Send, AlertCircle, Info, HelpCircle, RefreshCw, Lock, Copy } from 'lucide-react'

interface JournalEntryListProps {
  entries: JournalEntry[]
  isClosed?: boolean
  periodStatusByCompetence?: Record<string, string>
  onDuplicate?: (entry: JournalEntry) => void
}

function isPeriodLocked(status: string | undefined, fallbackClosed: boolean) {
  if (!status) return fallbackClosed
  return status !== 'OPEN' && status !== 'REOPENED'
}

export function JournalEntryList({ entries, isClosed = false, periodStatusByCompetence = {}, onDuplicate }: JournalEntryListProps) {
  const [isPending, startTransition] = useTransition()
  
  // Filtros locais de status
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'POSTED' | 'REVERSED'>('ALL')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Controle de estorno
  const [reversingEntry, setReversingEntry] = useState<JournalEntry | null>(null)

  // Filtra lançamentos
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (statusFilter === 'ALL') return true
      return entry.status === statusFilter
    })
  }, [entries, statusFilter])

  // Ação de postagem contábil definitiva
  const handlePost = (id: string) => {
    if (isClosed) return
    setSuccessMessage(null)
    setErrorMessage(null)

    if (confirm('Deseja efetivar este lançamento contábil? A ação gerará a numeração oficial no livro e não poderá ser desfeita ou editada.')) {
      startTransition(async () => {
        const res = await postJournalEntryAction({ journalEntryId: id })
        if (res.ok) {
          setSuccessMessage(res.message || 'Lançamento postado com sucesso!')
          setTimeout(() => setSuccessMessage(null), 4000)
        } else {
          setErrorMessage(res.error)
          setTimeout(() => setErrorMessage(null), 5500)
        }
      })
    }
  }

  // Confirmação e chamada da Server Action de Estorno
  const handleReverseConfirm = async (reason: string) => {
    if (!reversingEntry || isClosed) return

    setSuccessMessage(null)
    setErrorMessage(null)

    const res = await reverseJournalEntryAction({
      journalEntryId: reversingEntry.id,
      reason
    })

    if (res.ok) {
      setSuccessMessage(res.message || 'Lançamento estornado com sucesso!')
      setTimeout(() => setSuccessMessage(null), 4000)
    } else {
      setErrorMessage(res.error)
      setTimeout(() => setErrorMessage(null), 5500)
      throw new Error(res.error) // Repassa para o modal exibir o erro localmente
    }
  }

  return (
    <div className="space-y-6">
      {/* Filtros e Controles Rápidos */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Toggle de Status */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-gray-50 p-0.5 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Todos ({entries.length})
          </button>
          <button
            onClick={() => setStatusFilter('DRAFT')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === 'DRAFT'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Rascunhos ({entries.filter(e => e.status === 'DRAFT').length})
          </button>
          <button
            onClick={() => setStatusFilter('POSTED')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === 'POSTED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Publicados ({entries.filter(e => e.status === 'POSTED').length})
          </button>
          <button
            onClick={() => setStatusFilter('REVERSED')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === 'REVERSED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Estornados ({entries.filter(e => e.status === 'REVERSED').length})
          </button>
        </div>

        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
          Auditoria e estorno de lançamentos
        </span>
      </div>

      {/* Alertas Rápidos de Ações */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg text-sm flex gap-2.5 items-start">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
          <div className="font-semibold">{successMessage}</div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-sm flex gap-2.5 items-start">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="font-semibold">{errorMessage}</div>
        </div>
      )}

      {/* Listagem de Lançamentos */}
      <div className="space-y-6">
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => {
            const isDraft = entry.status === 'DRAFT'
            const isPosted = entry.status === 'POSTED'
            const isReversed = entry.status === 'REVERSED'
            const isReversalOrigin = entry.origin === 'REVERSAL'
            const entryPeriodStatus = periodStatusByCompetence[entry.competence]
            const entryIsLocked = isPeriodLocked(entryPeriodStatus, isClosed)

            return (
              <div key={entry.id} className="relative group">
                <JournalEntryCard entry={entry} />

                {/* Duplicar — Etapa 30A ("Novo a partir deste"). Disponível para qualquer
                    status: só lê os dados do lançamento original, nunca o altera. */}
                {onDuplicate && (
                  <div className="bg-white px-4 py-2 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => onDuplicate(entry)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 text-[11px] font-semibold rounded transition-colors cursor-pointer"
                      title="Cria um novo rascunho pré-preenchido com os dados deste lançamento"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Duplicar
                    </button>
                  </div>
                )}

                {/* Rodapé de Ações - Rascunho */}
                {isDraft && (
                  <div className="bg-gray-50/50 px-4 py-3 border-t border-gray-200 rounded-b-xl flex items-center justify-between gap-4 bg-white/70">
                    <span className="text-xs text-amber-600 font-semibold flex items-center gap-1.5">
                      {entryIsLocked
                        ? '⚠️ Rascunho não integrável (Período Bloqueado).'
                        : '⚠️ Rascunho não integrado aos relatórios oficiais.'}
                    </span>
                    {entryIsLocked ? (
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-150 text-gray-400 font-semibold text-xs border border-gray-200 rounded shadow cursor-not-allowed"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Postagem Bloqueada ({entryPeriodStatus || 'Período'})
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePost(entry.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-xs rounded shadow transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isPending ? 'Postando...' : 'Postar / Efetivar Contabilmente'}
                      </button>
                    )}
                  </div>
                )}

                {/* Rodapé de Ações - Publicado */}
                {isPosted && (
                  <div className="bg-gray-50/50 px-4 py-3 border-t border-gray-200 rounded-b-xl flex items-center justify-between gap-4 bg-white/70">
                    {isReversalOrigin ? (
                      <span className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                        ℹ️ Lançamento corretivo de estorno (não estornável secundariamente).
                      </span>
                    ) : entryIsLocked ? (
                      <>
                        <span className="text-xs text-green-700 font-semibold flex items-center gap-1.5">
                          ✓ Lançamento oficial integrado ao diário e balancete.
                        </span>
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-150 text-gray-400 font-semibold text-xs border border-gray-200 rounded shadow cursor-not-allowed"
                        >
                          <Lock className="w-3.5 h-3.5" /> Estorno Bloqueado ({entryPeriodStatus || 'Período'})
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-green-700 font-semibold flex items-center gap-1.5">
                          ✓ Lançamento oficial integrado ao diário e balancete.
                        </span>
                        <button
                          onClick={() => setReversingEntry(entry)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-semibold text-xs rounded shadow transition-all cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Estornar Lançamento
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Rodapé de Ações - Estornado */}
                {isReversed && (
                  <div className="bg-red-50/30 px-4 py-3 border-t border-gray-200 rounded-b-xl flex items-center justify-between gap-4">
                    <span className="text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                      ✕ Este lançamento foi anulado por estorno contábil e não aceita ações.
                    </span>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center max-w-md mx-auto space-y-3 shadow-sm">
            <div className="p-3 bg-gray-50 text-gray-400 rounded-full w-fit mx-auto">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-gray-700">Nenhum lançamento no filtro</h4>
            <p className="text-sm text-gray-500">
              Não existem lançamentos contábeis que correspondam ao status de filtragem selecionado.
            </p>
          </div>
        )}
      </div>

      {/* Modal Dialog para Justificativa e Confirmação do Estorno */}
      {reversingEntry && (
        <JournalReversalDialog
          entry={reversingEntry}
          isOpen={!!reversingEntry}
          onClose={() => setReversingEntry(null)}
          onConfirm={handleReverseConfirm}
        />
      )}
    </div>
  )
}
