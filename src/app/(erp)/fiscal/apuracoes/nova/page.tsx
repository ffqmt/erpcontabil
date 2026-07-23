import React from 'react'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import { getCompanyById } from '@/modules/registrations/companies/queries'
import { TaxAssessmentForm } from '@/modules/tax-assessments/components/tax-assessment-form'
import { getEnabledTaxAssessmentOptions, CompanyTaxAssessmentSetting } from '@/modules/tax-assessments/settings/options'
import { listCompanyTaxAssessmentSettings } from '@/modules/tax-assessments/settings/queries'
import { FileStack, AlertTriangle, ArrowLeft, Settings } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NewTaxAssessmentPage() {
  const context = await getCurrentContext()

  // 1. Validar carregamento da empresa ativa
  let company = null
  try {
    company = await getCompanyById(context.companyId, context.workspaceId)
  } catch (error) {
    console.error('[nova-apuracao-company-error]', error)
  }

  if (!company) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <FileStack className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Nova Apuração Fiscal</h2>
            <p className="text-sm text-gray-500">Escolha o tributo e a competência.</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <h3 className="font-bold text-base">Empresa ativa não encontrada</h3>
          </div>
          <p className="text-sm text-amber-800">
            Verifique o contexto selecionado antes de criar uma apuração.
          </p>
          <div className="pt-2">
            <Link
              href="/fiscal"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold rounded-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Módulo Fiscal
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const taxRegime = company.tax_regime || 'SIMPLES_NACIONAL'

  // 2. Validar busca de configurações tributárias
  let assessmentSettings: CompanyTaxAssessmentSetting[] = []
  let settingsError = false

  try {
    assessmentSettings = await listCompanyTaxAssessmentSettings(context.companyId, taxRegime)
  } catch (error) {
    console.error('[nova-apuracao-settings-error]', error)
    settingsError = true
  }

  if (settingsError) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <FileStack className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Nova Apuração Fiscal</h2>
            <p className="text-sm text-gray-500">Escolha o tributo e a competência.</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <h3 className="font-bold text-base">Não foi possível carregar as configurações tributárias</h3>
          </div>
          <p className="text-sm text-red-800">
            Verifique as configurações fiscais da empresa ou tente novamente.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/fiscal/configuracoes-tributarias"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold rounded-lg transition-all"
            >
              <Settings className="w-4 h-4" />
              Configurações Tributárias
            </Link>
            <Link
              href="/fiscal"
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 hover:bg-red-100 text-sm font-semibold rounded-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Módulo Fiscal
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 3. Validar tributos habilitados
  const taxOptions = getEnabledTaxAssessmentOptions(assessmentSettings)

  if (taxOptions.length === 0) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <FileStack className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Nova Apuração Fiscal</h2>
            <p className="text-sm text-gray-500">Escolha o tributo e a competência.</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <h3 className="font-bold text-base">Nenhum tributo habilitado para apuração</h3>
          </div>
          <p className="text-sm text-amber-800">
            Configure os tributos da empresa antes de criar uma nova apuração.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/fiscal/configuracoes-tributarias"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold rounded-lg transition-all"
            >
              <Settings className="w-4 h-4" />
              Configurar Tributos
            </Link>
            <Link
              href="/fiscal"
              className="inline-flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-800 hover:bg-amber-100 text-sm font-semibold rounded-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Módulo Fiscal
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
      <TaxAssessmentForm
        defaultCompetence={context.competence}
        taxOptions={taxOptions}
        assessmentSettings={assessmentSettings}
      />
    </div>
  )
}


