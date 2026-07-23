'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TaxAssessmentLine } from '../types'
import { formatCurrencyBRL } from '../utils'
import { deleteTaxAssessmentManualLineAction } from '../actions'
import { TaxAssessmentManualLineForm } from './tax-assessment-manual-line-form'
import { ListTree, Pencil, Trash2 } from 'lucide-react'

const LINE_TYPE_LABEL: Record<string, string> = {
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  RETENTION: 'Retenção',
  ADJUSTMENT_POSITIVE: 'Ajuste (+)',
  ADJUSTMENT_NEGATIVE: 'Ajuste (-)',
  BALANCE: 'Saldo'
}

const LINE_TYPE_TONE: Record<string, string> = {
  DEBIT: 'text-red-700',
  CREDIT: 'text-emerald-700',
  RETENTION: 'text-amber-700',
  ADJUSTMENT_POSITIVE: 'text-red-600',
  ADJUSTMENT_NEGATIVE: 'text-emerald-600',
  BALANCE: 'text-gray-700'
}

function originLabel(sourceType: string | null) {
  switch (sourceType) {
    case 'FISCAL_DOCUMENT': return 'Documento Fiscal'
    case 'FISCAL_ITEM': return 'Item Fiscal'
    case 'RETENTION': return 'Retenção'
    case 'MANUAL_ADJUSTMENT': return 'Manual'
    case 'PREVIOUS_BALANCE': return 'Saldo Anterior'
    default: return sourceType || '—'
  }
}

function LineRow({ line, editable, taxAssessmentId }: { line: TaxAssessmentLine; editable: boolean; taxAssessmentId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const isManual = line.source_type === 'MANUAL_ADJUSTMENT'

  function handleDelete() {
    if (!window.confirm('Remover esta linha manual?')) return
    startTransition(async () => {
      await deleteTaxAssessmentManualLineAction({ id: line.id, taxAssessmentId })
      router.refresh()
    })
  }

  if (isEditing) {
    return (
      <tr>
        <td colSpan={6} className="py-2">
          <TaxAssessmentManualLineForm taxAssessmentId={taxAssessmentId} line={line} onDone={() => setIsEditing(false)} />
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="py-2 text-gray-700">
        {line.description}
        {line.notes && <span className="block text-[10px] text-gray-400">{line.notes}</span>}
      </td>
      <td className="py-2">
        <span className={`font-semibold ${LINE_TYPE_TONE[line.line_type || ''] || 'text-gray-500'}`}>{LINE_TYPE_LABEL[line.line_type || ''] || line.line_type}</span>
      </td>
      <td className="py-2 text-gray-400">{originLabel(line.source_type)}</td>
      <td className="py-2 text-right font-mono text-gray-500">{line.base_amount ? formatCurrencyBRL(line.base_amount) : '—'}</td>
      <td className="py-2 text-right font-mono text-gray-500">{line.tax_rate ? `${Number(line.tax_rate).toFixed(2)}%` : '—'}</td>
      <td className="py-2 text-right font-mono font-semibold">{formatCurrencyBRL(line.amount)}</td>
      {editable && (
        <td className="py-2 text-right whitespace-nowrap">
          {isManual && (
            <span className="inline-flex gap-1">
              <button onClick={() => setIsEditing(true)} className="p-1 text-gray-400 hover:text-indigo-600 cursor-pointer" title="Editar linha manual">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleDelete} disabled={isPending} className="p-1 text-gray-400 hover:text-red-600 cursor-pointer disabled:opacity-50" title="Remover linha manual">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
        </td>
      )}
    </tr>
  )
}

export function TaxAssessmentLinesTable({ lines, taxAssessmentId, editable = false }: { lines: TaxAssessmentLine[]; taxAssessmentId: string; editable?: boolean }) {
  if (lines.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 text-xs text-gray-400 flex items-center gap-2">
        <ListTree className="w-4 h-4 text-gray-300" />
        Nenhuma linha de apuração ainda — clique em &quot;Calcular&quot; para consolidar os documentos fiscais da competência, ou adicione uma linha manual.
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Linhas da Apuração</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-gray-400 uppercase text-[10px] border-b border-gray-100">
            <tr>
              <th className="text-left py-2">Descrição</th>
              <th className="text-left py-2">Tipo</th>
              <th className="text-left py-2">Origem</th>
              <th className="text-right py-2">Base</th>
              <th className="text-right py-2">Alíquota</th>
              <th className="text-right py-2">Valor</th>
              {editable && <th className="text-right py-2">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lines.map((line) => (
              <LineRow key={line.id} line={line} editable={editable} taxAssessmentId={taxAssessmentId} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
