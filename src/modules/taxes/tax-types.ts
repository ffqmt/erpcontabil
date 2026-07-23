/**
 * Etapa 35A — registry central de metadados de tributo (TaxType). Antes desta etapa, o
 * conjunto de tributos existia replicado em pelo menos 4 lugares (TaxType em
 * src/modules/fiscal/types.ts e src/modules/tax-assessments/types.ts, o enum Zod de
 * apuração, o enum Zod de retenções, o CHECK de company_tax_assessment_settings e os mapas
 * de cálculo HEADER_TAX_FIELD/CREDIT_ELIGIBLE_TAX_TYPES) — cada um já divergindo de forma
 * sutil e intencional (ex.: PIS/COFINS fora de company_tax_assessment_settings por design,
 * IRPJ/CSLL fora do enum de retenções). Este arquivo não troca nenhum desses pontos (o enum
 * Postgres `tax_type` e as validações Zod existentes continuam como estão) — é a fonte de
 * consulta central para código NOVO, e para quando a Etapa 35C precisar decidir se
 * CBS/IBS/IS entram nas mesmas listas ou não, sem repetir a divergência silenciosa que já
 * existe hoje.
 */

export type TaxTypeCode = 'ISS' | 'ICMS' | 'IPI' | 'PIS' | 'COFINS' | 'SIMPLES' | 'INSS_RETIDO' | 'IRRF' | 'PCC' | 'IRPJ' | 'CSLL' | 'OTHER'

export type TaxTypeCategory = 'CONSUMPTION' | 'INCOME' | 'WITHHOLDING' | 'OTHER'

export interface TaxTypeMeta {
  code: TaxTypeCode
  label: string
  category: TaxTypeCategory
  /** Entra no pipeline de tax_assessments (company_tax_assessment_settings/tax_assessments). */
  isAssessable: boolean
  /** Contabilizado direto no lançamento do documento fiscal por regra contábil (nunca por apuração) — hoje só PIS/COFINS. */
  isDocumentAccounted: boolean
  /** Pode aparecer em fiscal_document_retentions. */
  isRetentionEligible: boolean
  /** Categoria WITHHOLDING (INSS_RETIDO/IRRF/PCC) — retenção pura, nunca débito/crédito de operação própria. */
  isWithholding: boolean
  /** Existe algum caminho de cálculo automático no código hoje (generateAutomaticLines, calculateIncomeTaxAssessmentAction, etc.) — false para os que são sempre lançados manualmente. */
  supportsAutomaticCalculation: boolean
  /** Modo de cálculo padrão quando não há linha salva em company_tax_assessment_settings. */
  defaultCalculationMode: 'AUTO' | 'MANUAL'
  /** Depende de tabela de alíquota/vigência (tax_regime_rates ou equivalente) para calcular automaticamente. */
  requiresRateConfiguration: boolean
  /** Reservado para a Etapa 35C — nenhum tributo hoje pertence à Reforma Tributária (CBS/IBS/IS ainda não existem neste registry). */
  isTaxReformTax: boolean
}

export const TAX_TYPES: Record<TaxTypeCode, TaxTypeMeta> = {
  ISS: { code: 'ISS', label: 'ISS', category: 'CONSUMPTION', isAssessable: true, isDocumentAccounted: false, isRetentionEligible: true, isWithholding: false, supportsAutomaticCalculation: true, defaultCalculationMode: 'AUTO', requiresRateConfiguration: false, isTaxReformTax: false },
  ICMS: { code: 'ICMS', label: 'ICMS', category: 'CONSUMPTION', isAssessable: true, isDocumentAccounted: false, isRetentionEligible: true, isWithholding: false, supportsAutomaticCalculation: true, defaultCalculationMode: 'AUTO', requiresRateConfiguration: false, isTaxReformTax: false },
  IPI: { code: 'IPI', label: 'IPI', category: 'CONSUMPTION', isAssessable: true, isDocumentAccounted: false, isRetentionEligible: true, isWithholding: false, supportsAutomaticCalculation: true, defaultCalculationMode: 'AUTO', requiresRateConfiguration: false, isTaxReformTax: false },
  PIS: { code: 'PIS', label: 'PIS', category: 'CONSUMPTION', isAssessable: false, isDocumentAccounted: true, isRetentionEligible: true, isWithholding: false, supportsAutomaticCalculation: false, defaultCalculationMode: 'MANUAL', requiresRateConfiguration: false, isTaxReformTax: false },
  COFINS: { code: 'COFINS', label: 'COFINS', category: 'CONSUMPTION', isAssessable: false, isDocumentAccounted: true, isRetentionEligible: true, isWithholding: false, supportsAutomaticCalculation: false, defaultCalculationMode: 'MANUAL', requiresRateConfiguration: false, isTaxReformTax: false },
  SIMPLES: { code: 'SIMPLES', label: 'Simples Nacional', category: 'CONSUMPTION', isAssessable: true, isDocumentAccounted: false, isRetentionEligible: true, isWithholding: false, supportsAutomaticCalculation: true, defaultCalculationMode: 'AUTO', requiresRateConfiguration: true, isTaxReformTax: false },
  INSS_RETIDO: { code: 'INSS_RETIDO', label: 'INSS Retido', category: 'WITHHOLDING', isAssessable: true, isDocumentAccounted: false, isRetentionEligible: true, isWithholding: true, supportsAutomaticCalculation: false, defaultCalculationMode: 'MANUAL', requiresRateConfiguration: false, isTaxReformTax: false },
  IRRF: { code: 'IRRF', label: 'IRRF', category: 'WITHHOLDING', isAssessable: true, isDocumentAccounted: false, isRetentionEligible: true, isWithholding: true, supportsAutomaticCalculation: false, defaultCalculationMode: 'MANUAL', requiresRateConfiguration: false, isTaxReformTax: false },
  PCC: { code: 'PCC', label: 'PIS/COFINS/CSLL Retidos (CSRF)', category: 'WITHHOLDING', isAssessable: true, isDocumentAccounted: false, isRetentionEligible: true, isWithholding: true, supportsAutomaticCalculation: false, defaultCalculationMode: 'MANUAL', requiresRateConfiguration: false, isTaxReformTax: false },
  IRPJ: { code: 'IRPJ', label: 'IRPJ', category: 'INCOME', isAssessable: true, isDocumentAccounted: false, isRetentionEligible: false, isWithholding: false, supportsAutomaticCalculation: true, defaultCalculationMode: 'AUTO', requiresRateConfiguration: true, isTaxReformTax: false },
  CSLL: { code: 'CSLL', label: 'CSLL', category: 'INCOME', isAssessable: true, isDocumentAccounted: false, isRetentionEligible: false, isWithholding: false, supportsAutomaticCalculation: true, defaultCalculationMode: 'AUTO', requiresRateConfiguration: true, isTaxReformTax: false },
  OTHER: { code: 'OTHER', label: 'Outro', category: 'OTHER', isAssessable: true, isDocumentAccounted: false, isRetentionEligible: true, isWithholding: false, supportsAutomaticCalculation: false, defaultCalculationMode: 'MANUAL', requiresRateConfiguration: false, isTaxReformTax: false }
}

export const TAX_TYPE_LIST: TaxTypeMeta[] = Object.values(TAX_TYPES)

export function getTaxTypeMeta(code: string): TaxTypeMeta | undefined {
  return TAX_TYPES[code as TaxTypeCode]
}

export function isAssessableTaxTypeCode(code: string): boolean {
  return getTaxTypeMeta(code)?.isAssessable ?? false
}

export function isDocumentAccountedTaxTypeCode(code: string): boolean {
  return getTaxTypeMeta(code)?.isDocumentAccounted ?? false
}

export function isRetentionEligibleTaxTypeCode(code: string): boolean {
  return getTaxTypeMeta(code)?.isRetentionEligible ?? false
}
