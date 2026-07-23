import { getClient } from '@/lib/supabase/server'
import { TaxRegime } from '@/modules/registrations/companies/types'
import { CompanyTaxAssessmentSetting, mergeTaxAssessmentSettings } from './options'

async function getDb() {
  return getClient()
}

export async function listCompanyTaxAssessmentSettings(
  companyId: string,
  taxRegime?: TaxRegime | string | null
): Promise<CompanyTaxAssessmentSetting[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')

  const db = await getDb()
  const { data, error } = await db
    .from('company_tax_assessment_settings')
    .select('id, company_id, tax_type, enabled, account_assessment, calculation_mode, notes')
    .eq('company_id', companyId)
    .order('tax_type', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Falha ao buscar configuração de apuração tributária.')
  }

  return mergeTaxAssessmentSettings(companyId, taxRegime, (data || []) as Partial<CompanyTaxAssessmentSetting>[])
}
