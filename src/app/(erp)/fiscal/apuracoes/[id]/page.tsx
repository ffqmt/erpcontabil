import React from 'react'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import { getTaxAssessmentById } from '@/modules/tax-assessments/queries'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { TaxAssessmentStatusBadge } from '@/modules/tax-assessments/components/tax-assessment-status-badge'
import { TaxAssessmentWorkflowActions } from '@/modules/tax-assessments/components/tax-assessment-workflow-actions'
import { TaxAssessmentSummaryCards } from '@/modules/tax-assessments/components/tax-assessment-summary-cards'
import { TaxAssessmentPreviousBalanceForm } from '@/modules/tax-assessments/components/tax-assessment-previous-balance-form'
import { TaxAssessmentLinesTable } from '@/modules/tax-assessments/components/tax-assessment-lines-table'
import { TaxAssessmentManualLineForm } from '@/modules/tax-assessments/components/tax-assessment-manual-line-form'
import { TaxAssessmentAccountingForm } from '@/modules/tax-assessments/components/tax-assessment-accounting-form'
import { IncomeTaxAdjustmentsPanel } from '@/modules/tax-assessments/components/income-tax-adjustments-panel'
import { GenerateObligationButton } from '@/modules/tax-assessments/components/generate-obligation-button'
import { formatCompetenceBR, EDITABLE_ASSESSMENT_STATUSES } from '@/modules/tax-assessments/utils'
import { FileStack } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TaxAssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()

  const assessment = await getTaxAssessmentById(id, context.companyId)
  if (!assessment) notFound()

  const chartAccounts = await getAccounts(context.companyId)
  const editable = EDITABLE_ASSESSMENT_STATUSES.includes(assessment.status) && !assessment.obligation_id

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <FileStack className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Apuração de {assessment.tax_type}</h2>
            <p className="text-sm text-gray-500">{formatCompetenceBR(assessment.competence)}</p>
          </div>
        </div>
        <TaxAssessmentStatusBadge status={assessment.status} />
      </div>

      <TaxAssessmentSummaryCards assessment={assessment} />
      <TaxAssessmentWorkflowActions assessment={assessment} />
      {editable && <TaxAssessmentPreviousBalanceForm assessment={assessment} />}
      <TaxAssessmentLinesTable lines={assessment.lines || []} taxAssessmentId={assessment.id} editable={editable} />
      {editable && <TaxAssessmentManualLineForm taxAssessmentId={assessment.id} />}
      {(assessment.tax_type === 'IRPJ' || assessment.tax_type === 'CSLL') && (
        <IncomeTaxAdjustmentsPanel assessment={assessment} editable={editable} />
      )}
      <GenerateObligationButton assessment={assessment} />
      <TaxAssessmentAccountingForm assessment={assessment} chartAccounts={chartAccounts} />
    </div>
  )
}
