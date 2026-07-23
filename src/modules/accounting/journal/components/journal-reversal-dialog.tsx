'use client'

import React, { useState } from 'react'
import { JournalEntry } from '../types'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface JournalReversalDialogProps {
  entry: JournalEntry
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

export function JournalReversalDialog({
  entry,
  isOpen,
  onClose,
  onConfirm
}: JournalReversalDialogProps) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 5) return

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      await onConfirm(reason)
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao processar o estorno contábil.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden animate-slide-up">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-gray-150 flex items-center gap-3 bg-amber-50 text-amber-900">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Estornar Lançamento nº {entry.number}</h3>
            <p className="text-[11px] text-amber-800/80 mt-0.5">Apuração reversa de partidas dobradas.</p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs text-gray-500 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-200">
            <strong className="text-gray-700 block mb-1">Aviso Importante:</strong>
            Esta ação não apaga nem edita o lançamento original. Um novo lançamento contábil inverso (estorno) será gerado e publicado automaticamente com origem <span className="font-mono bg-gray-200 px-1 rounded text-gray-700">REVERSAL</span> para anular o saldo das contas afetadas.
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reason" className="text-xs font-bold text-gray-600 block">
              Motivo do Estorno <span className="text-red-500">*</span>
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Digite uma justificativa para este estorno (mínimo de 5 caracteres)..."
              className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 placeholder-gray-400 font-sans"
              required
            />
            <span className="text-[10px] text-gray-400 block text-right font-medium">
              {reason.length}/500 caracteres
            </span>
          </div>

          {errorMsg && (
            <div className="text-xs text-red-700 bg-red-50 p-3 rounded-lg border border-red-150 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={reason.trim().length < 5 || isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...
                </>
              ) : (
                'Confirmar Estorno'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
