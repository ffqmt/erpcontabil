import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getCompanyById } from '@/modules/registrations/companies/queries'
import { listTaxRegimeRates } from '@/modules/tax-assessments/regime-rates/queries'
import { listCompanyTaxAssessmentSettings } from '@/modules/tax-assessments/settings/queries'
import { getFiscalNatures } from '@/modules/registrations/fiscal-natures/queries'
import { TaxRegimeRatesPanel } from '@/modules/tax-assessments/regime-rates/components/tax-regime-rates-panel'
import { CompanyTaxAssessmentSettingsPanel } from '@/modules/tax-assessments/settings/components/company-tax-assessment-settings-panel'
import { getPisCofinsRecoverySettings } from '@/modules/fiscal/pis-cofins-recovery/queries'
import { PisCofinsRecoveryPanel } from '@/modules/fiscal/pis-cofins-recovery/components/pis-cofins-recovery-panel'
import { Percent } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TaxRegimeRatesPage() {
  const context = await getCurrentContext()

  const company = await getCompanyById(context.companyId, context.workspaceId)
  const taxRegime = company?.tax_regime || 'SIMPLES_NACIONAL'

  const [rates, fiscalNatures, assessmentSettings, pisCofinsRecoverySettings] = await Promise.all([
    listTaxRegimeRates(context.companyId),
    getFiscalNatures(context.companyId),
    listCompanyTaxAssessmentSettings(context.companyId, taxRegime),
    getPisCofinsRecoverySettings(context.companyId)
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Percent className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Configurações Tributárias</h2>
          <p className="text-sm text-gray-500">Alíquotas e percentuais de presunção de IRPJ/CSLL/Simples por regime — usados pelo motor de apuração, nunca hardcoded.</p>
        </div>
      </div>
      <CompanyTaxAssessmentSettingsPanel taxRegime={taxRegime} settings={assessmentSettings} />
      <TaxRegimeRatesPanel rates={rates} fiscalNatures={fiscalNatures.filter((n) => n.is_active)} />
      <PisCofinsRecoveryPanel settings={pisCofinsRecoverySettings} taxRegime={taxRegime} />
    </div>
  )
}
