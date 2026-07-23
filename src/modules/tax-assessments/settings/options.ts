import { TaxRegime } from '@/modules/registrations/companies/types'
import { TaxType } from '../types'
import { TAX_TYPE_LIST, TaxTypeCode } from '@/modules/taxes/tax-types'

export type TaxAssessmentCalculationMode = 'AUTO' | 'MANUAL'

export interface CompanyTaxAssessmentSetting {
  id: string | null
  company_id: string
  tax_type: AssessableTaxType
  enabled: boolean
  account_assessment: boolean
  calculation_mode: TaxAssessmentCalculationMode
  notes: string | null
}

export interface TaxAssessmentOption {
  value: AssessableTaxType
  label: string
  description: string
}

// Etapa 35A: derivado do registry central (src/modules/taxes/tax-types.ts) em vez de
// listado à mão de novo — mantém o mesmo conjunto de valores de antes (PIS/COFINS ficam
// fora por design, contabilizados direto no documento fiscal).
export const DOCUMENT_ACCOUNTED_TAX_TYPES: readonly TaxTypeCode[] = TAX_TYPE_LIST.filter((t) => t.isDocumentAccounted).map((t) => t.code)

// Tipo mantido explícito (em vez de inferido do array) para preservar a união literal
// exata usada em todo o módulo — o array em si é que passa a vir do registry central, não
// mais digitado à mão duas vezes.
export type AssessableTaxType = 'ISS' | 'ICMS' | 'IPI' | 'SIMPLES' | 'INSS_RETIDO' | 'IRRF' | 'PCC' | 'IRPJ' | 'CSLL' | 'OTHER'

export const ASSESSABLE_TAX_TYPE_VALUES = TAX_TYPE_LIST.filter((t) => t.isAssessable).map((t) => t.code) as readonly AssessableTaxType[]

export const TAX_ASSESSMENT_OPTIONS: TaxAssessmentOption[] = [
  { value: 'ISS', label: 'ISS', description: 'Serviços prestados/tomados conforme documentos escriturados.' },
  { value: 'ICMS', label: 'ICMS', description: 'Débitos e créditos a partir dos documentos fiscais escriturados.' },
  { value: 'IPI', label: 'IPI', description: 'Valores destacados nos itens dos documentos escriturados.' },
  { value: 'SIMPLES', label: 'Simples Nacional', description: 'DAS calculado sobre receita escriturada e alíquota configurada.' },
  { value: 'INSS_RETIDO', label: 'INSS Retido', description: 'Retenções vinculadas aos documentos fiscais.' },
  { value: 'IRRF', label: 'IRRF', description: 'Retenções vinculadas aos documentos fiscais.' },
  { value: 'PCC', label: 'PCC', description: 'Retenções de PIS/COFINS/CSLL em documentos fiscais.' },
  { value: 'IRPJ', label: 'IRPJ', description: 'Lucro Presumido ou Lucro Real conforme regime e alíquotas.' },
  { value: 'CSLL', label: 'CSLL', description: 'Lucro Presumido ou Lucro Real conforme regime e alíquotas.' },
  { value: 'OTHER', label: 'Outro', description: 'Apuração manual para casos fora dos tributos padrão.' }
]

const OPTION_BY_TAX = new Map(TAX_ASSESSMENT_OPTIONS.map((option) => [option.value, option]))

export function isAssessableTaxType(taxType: string): taxType is AssessableTaxType {
  return ASSESSABLE_TAX_TYPE_VALUES.includes(taxType as AssessableTaxType)
}

export function isDocumentAccountedTaxType(taxType: TaxType | string): boolean {
  return DOCUMENT_ACCOUNTED_TAX_TYPES.includes(taxType as (typeof DOCUMENT_ACCOUNTED_TAX_TYPES)[number])
}

export function getTaxAssessmentOption(taxType: AssessableTaxType): TaxAssessmentOption {
  return OPTION_BY_TAX.get(taxType) || { value: taxType, label: taxType, description: '' }
}

export function getDefaultEnabledTaxTypes(taxRegime?: TaxRegime | string | null): AssessableTaxType[] {
  if (taxRegime === 'SIMPLES_NACIONAL') return ['SIMPLES']
  if (taxRegime === 'LUCRO_PRESUMIDO' || taxRegime === 'LUCRO_REAL') return ['ISS', 'ICMS', 'IPI', 'IRPJ', 'CSLL']
  return ['ISS', 'ICMS', 'IPI']
}

export function buildDefaultTaxAssessmentSettings(companyId: string, taxRegime?: TaxRegime | string | null): CompanyTaxAssessmentSetting[] {
  const enabledDefaults = new Set(getDefaultEnabledTaxTypes(taxRegime))
  return ASSESSABLE_TAX_TYPE_VALUES.map((taxType) => ({
    id: null,
    company_id: companyId,
    tax_type: taxType,
    enabled: enabledDefaults.has(taxType),
    account_assessment: taxType !== 'OTHER',
    calculation_mode: ['INSS_RETIDO', 'IRRF', 'PCC', 'OTHER'].includes(taxType) ? 'MANUAL' : 'AUTO',
    notes: null
  }))
}

export function mergeTaxAssessmentSettings(
  companyId: string,
  taxRegime: TaxRegime | string | null | undefined,
  rows: Partial<CompanyTaxAssessmentSetting>[]
): CompanyTaxAssessmentSetting[] {
  const byTax = new Map(rows.filter((row) => row.tax_type && isAssessableTaxType(row.tax_type)).map((row) => [row.tax_type as AssessableTaxType, row]))

  return buildDefaultTaxAssessmentSettings(companyId, taxRegime).map((defaultRow) => {
    const row = byTax.get(defaultRow.tax_type)
    if (!row) return defaultRow
    return {
      ...defaultRow,
      id: row.id || null,
      enabled: row.enabled ?? defaultRow.enabled,
      account_assessment: row.account_assessment ?? defaultRow.account_assessment,
      calculation_mode: row.calculation_mode === 'MANUAL' ? 'MANUAL' : 'AUTO',
      notes: row.notes ?? null
    }
  })
}

export function getEnabledTaxAssessmentOptions(settings: CompanyTaxAssessmentSetting[]): TaxAssessmentOption[] {
  return settings
    .filter((setting) => setting.enabled)
    .map((setting) => getTaxAssessmentOption(setting.tax_type))
}
