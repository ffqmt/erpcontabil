'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiscalDocument } from '../types'
import { validateFiscalDocumentAction, bookFiscalDocumentAction, cancelFiscalDocumentAction } from '../actions'
import { CheckCircle2, BookMarked, Ban, Pencil } from 'lucide-react'

export function FiscalDocumentWorkflowActions({ doc }: { doc: FiscalDocument }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCancel, setShowCancel] = useState(false)
  const [reason, setReason] = useState('')

  function handleValidate() {
    startTransition(async () => {
      await validateFiscalDocumentAction({ id: doc.id })
      router.refresh()
    })
  }

  function handleBook() {
    startTransition(async () => {
      await bookFiscalDocumentAction({ id: doc.id })
      router.refresh()
    })
  }

  function handleCancel() {
    if (!reason.trim()) return
    startTransition(async () => {
      await cancelFiscalDocumentAction({ id: doc.id, reason })
      setShowCancel(false)
      setReason('')
      router.refresh()
    })
  }

  const canEdit = doc.status === 'DRAFT' || doc.status === 'IMPORTED' || doc.status === 'VALIDATED'
  const canValidate = doc.status === 'DRAFT' || doc.status === 'IMPORTED'
  const canBook = doc.status === 'VALIDATED'
  const canCancel = doc.status !== 'CANCELLED' && !doc.journal_entry_id

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-2">
      {canEdit && (
        <Link href={`/fiscal/documentos/${doc.id}/editar`} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 text-gray-600 hover:text-emerald-700 text-xs font-semibold rounded-lg transition-colors">
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Link>
      )}
      {canValidate && (
        <button onClick={handleValidate} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Validar
        </button>
      )}
      {canBook && (
        <button onClick={handleBook} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
          <BookMarked className="w-3.5 h-3.5" />
          Escriturar
        </button>
      )}
      {canCancel && !showCancel && (
        <button onClick={() => setShowCancel(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg cursor-pointer">
          <Ban className="w-3.5 h-3.5" />
          Cancelar Documento
        </button>
      )}
      {showCancel && (
        <div className="flex items-center gap-2">
          <input className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs" placeholder="Justificativa..." value={reason} onChange={(e) => setReason(e.target.value)} />
          <button onClick={handleCancel} disabled={isPending || !reason.trim()} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
            Confirmar
          </button>
        </div>
      )}
    </div>
  )
}
