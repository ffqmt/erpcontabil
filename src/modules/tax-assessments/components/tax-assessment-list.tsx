import React from 'react'
import Link from 'next/link'
import { TaxAssessment } from '../types'
import { TaxAssessmentStatusBadge } from './tax-assessment-status-badge'
import { formatCurrencyBRL, formatCompetenceBR } from '../utils'
import { FileStack, ChevronRight } from 'lucide-react'

export function TaxAssessmentList({ assessments }: { assessments: TaxAssessment[] }) {
  if (assessments.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <FileStack className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhuma apuração fiscal cadastrada</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {assessments.map((a) => (
        <Link key={a.id} href={`/fiscal/apuracoes/${a.id}`} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4 hover:shadow-sm hover:border-emerald-300 transition-all">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-800 text-sm">{a.tax_type}</span>
              <span className="text-xs text-gray-400">{formatCompetenceBR(a.competence)}</span>
              <TaxAssessmentStatusBadge status={a.status} />
            </div>
            <p className="text-[11px] text-gray-400">
              {a.journal_entry?.number ? `Lançamento nº ${a.journal_entry.number}` : 'Ainda não contabilizada'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="font-mono font-bold text-sm text-gray-800">{formatCurrencyBRL(a.payable_amount)}</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </Link>
      ))}
    </div>
  )
}
