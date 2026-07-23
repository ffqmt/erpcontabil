import React from 'react'
import Link from 'next/link'
import { FiscalDocument } from '../types'
import { formatCurrencyBRL, formatDateBR, FISCAL_DOCUMENT_TYPE_LABELS } from '../utils'
import { FiscalDocumentStatusBadge } from './fiscal-document-status-badge'
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, AlertTriangle } from 'lucide-react'

interface FiscalDocumentCardProps {
  doc: FiscalDocument
  selectable?: boolean
  selected?: boolean
  onSelectedChange?: (selected: boolean) => void
}

export function FiscalDocumentCard({ doc, selectable = false, selected = false, onSelectedChange }: FiscalDocumentCardProps) {
  const Icon = doc.direction === 'IN' ? ArrowDownToLine : ArrowUpFromLine
  const amount = typeof doc.document_amount === 'string' ? parseFloat(doc.document_amount) : doc.document_amount
  const duplicated = (doc.active_accounting_application_count || 0) > 1
  const showNotAccountedBadge = doc.status !== 'DRAFT' && doc.status !== 'CANCELLED' && doc.accounting_status === 'NOT_ACCOUNTED'
  const showNotAssessedBadge = doc.status === 'BOOKED' && doc.tax_status === 'NOT_ASSESSED'

  return (
    <div className={`bg-white border rounded-xl transition-all ${duplicated ? 'border-red-300' : selected ? 'border-emerald-300 shadow-sm' : 'border-gray-200 hover:border-emerald-300 hover:shadow-sm'}`}>
      <div className="flex items-stretch">
        {selectable && (
          <label className="flex w-11 flex-shrink-0 items-center justify-center border-r border-gray-100 cursor-pointer">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelectedChange?.(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              aria-label={`Selecionar ${doc.number ? `documento ${doc.number}` : 'documento fiscal'}`}
            />
          </label>
        )}

        <Link href={`/fiscal/documentos/${doc.id}`} className="min-w-0 flex-1 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-lg border flex-shrink-0 ${doc.direction === 'IN' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-purple-50 border-purple-100 text-purple-600'}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-mono">{formatDateBR(doc.issue_date)}</span>
                <span className="font-semibold text-gray-800 text-sm">{FISCAL_DOCUMENT_TYPE_LABELS[doc.document_type]} {doc.number ? `nº ${doc.number}` : ''}</span>
                <FiscalDocumentStatusBadge status={doc.status} />
                {showNotAccountedBadge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200">
                    Não contabilizado
                  </span>
                )}
                {showNotAssessedBadge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200">
                    Não apurado
                  </span>
                )}
                {(doc.open_pendency_count || 0) > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertTriangle className="w-3 h-3" />
                    {doc.open_pendency_count} pendência{doc.open_pendency_count === 1 ? '' : 's'}
                  </span>
                )}
                {duplicated && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                    <AlertTriangle className="w-3 h-3" />
                    {doc.active_accounting_application_count}x contabilizado
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 truncate">
                {doc.partner?.name || 'Parceiro não informado'}
                {doc.fiscal_operation_nature ? ` · ${doc.fiscal_operation_nature.name}` : ''}
                {doc.journal_entry?.number ? ` · Lançamento nº ${doc.journal_entry.number}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="font-mono font-bold text-sm text-gray-800">{formatCurrencyBRL(amount)}</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </Link>
      </div>
    </div>
  )
}
