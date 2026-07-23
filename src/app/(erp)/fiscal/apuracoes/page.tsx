import React from 'react'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import { listTaxAssessments } from '@/modules/tax-assessments/queries'
import { TaxAssessmentList } from '@/modules/tax-assessments/components/tax-assessment-list'
import { FileStack, Plus, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TaxAssessmentsPage() {
  const context = await getCurrentContext()

  let errorMsg: string | null = null
  let assessments: Awaited<ReturnType<typeof listTaxAssessments>> = []

  try {
    assessments = await listTaxAssessments(context.companyId)
  } catch (error: any) {
    errorMsg = error.message || 'Falha ao carregar apurações fiscais.'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <FileStack className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Apurações Fiscais</h2>
            <p className="text-sm text-gray-500">Calcule, revise e feche os tributos por competência.</p>
          </div>
        </div>
        <Link href="/fiscal/apuracoes/nova" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all">
          <Plus className="w-4 h-4" />
          Nova Apuração
        </Link>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : (
        <TaxAssessmentList assessments={assessments} defaultCompetence={context.competence} />
      )}
    </div>
  )
}
