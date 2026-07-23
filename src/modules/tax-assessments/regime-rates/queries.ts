import { getClient } from '@/lib/supabase/server'
import { TaxRegimeRate, RegimeRateTaxType } from './types'

async function getDb() {
  return getClient()
}

export async function listTaxRegimeRates(companyId: string): Promise<TaxRegimeRate[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')
  const db = await getDb()
  const { data, error } = await db
    .from('tax_regime_rates')
    .select('*, fiscal_operation_nature:fiscal_operation_natures(code, name)')
    .eq('company_id', companyId)
    .order('tax_type', { ascending: true })
    .order('valid_from', { ascending: false })

  if (error) throw new Error(error.message || 'Falha ao buscar alíquotas configuradas.')
  return (data || []) as unknown as TaxRegimeRate[]
}

/**
 * Busca a alíquota vigente para um tributo/regime numa data de referência — prioriza uma
 * regra específica por natureza fiscal sobre a regra genérica da empresa, e a vigência
 * mais recente entre as que já começaram e ainda não terminaram na data de referência.
 * Retorna null se não houver nenhuma configurada (o motor de cálculo deve bloquear com
 * erro claro nesse caso, nunca usar um valor hardcoded como fallback).
 */
export async function findEffectiveTaxRegimeRate(
  companyId: string,
  taxRegime: string,
  taxType: RegimeRateTaxType,
  referenceDate: string,
  fiscalOperationNatureId?: string | null
): Promise<TaxRegimeRate | null> {
  const db = await getDb()
  const { data, error } = await db
    .from('tax_regime_rates')
    .select('*')
    .eq('company_id', companyId)
    .eq('tax_regime', taxRegime)
    .eq('tax_type', taxType)
    .eq('active', true)
    .lte('valid_from', referenceDate)
    .or(`valid_until.is.null,valid_until.gte.${referenceDate}`)

  if (error || !data) return null

  const rows = data as TaxRegimeRate[]
  const specific = fiscalOperationNatureId ? rows.filter((r) => r.fiscal_operation_nature_id === fiscalOperationNatureId) : []
  const generic = rows.filter((r) => !r.fiscal_operation_nature_id)
  const candidates = specific.length > 0 ? specific : generic

  if (candidates.length === 0) return null
  candidates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())
  return candidates[0]
}
