import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getCompanyById } from '@/modules/registrations/companies/queries'
import { TaxAssessmentForm } from '@/modules/tax-assessments/components/tax-assessment-form'
import { getEnabledTaxAssessmentOptions } from '@/modules/tax-assessments/settings/options'
import { listCompanyTaxAssessmentSettings } from '@/modules/tax-assessments/settings/queries'
import { FileStack } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NewTaxAssessmentPage() {
  const context = await getCurrentContext()
  const company = await getCompanyById(context.companyId, context.workspaceId)
  const taxRegime = company?.tax_regime || 'SIMPLES_NACIONAL'
  const assessmentSettings = await listCompanyTaxAssessmentSettings(context.companyId, taxRegime)
  const taxOptions = getEnabledTaxAssessmentOptions(assessmentSettings)

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <FileStack className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Nova Apuração Fiscal</h2>
          <p className="text-sm text-gray-500">Escolha o tributo e a competência — os documentos escriturados serão consolidados automaticamente.</p>
        </div>
      </div>
      <TaxAssessmentForm defaultCompetence={context.competence} taxOptions={taxOptions} />
    </div>
  )
}
