import { FiscalAccountingRule, FiscalAccountingRuleLine, ValueBase } from './types'

export type FiscalAmountSource = {
  document_amount?: number | string | null
  merchandise_amount?: number | string | null
  services_amount?: number | string | null
  freight_amount?: number | string | null
  insurance_amount?: number | string | null
  discount_amount?: number | string | null
  other_expenses_amount?: number | string | null
  icms_amount?: number | string | null
  ipi_amount?: number | string | null
  pis_amount?: number | string | null
  cofins_amount?: number | string | null
  iss_amount?: number | string | null
}

export type AccountingMemoSource = FiscalAmountSource & {
  id?: string
  number?: string | number | null
  partner?: { name?: string | null } | null
  partner_name?: string | null
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function valueBaseAmount(doc: FiscalAmountSource, base: ValueBase): number {
  switch (base) {
    case 'MERCHANDISE_AMOUNT':
      return Number(doc.merchandise_amount ?? doc.document_amount ?? 0)
    case 'SERVICES_AMOUNT':
      return Number(doc.services_amount ?? doc.document_amount ?? 0)
    case 'FREIGHT_AMOUNT':
      return Number(doc.freight_amount ?? 0)
    case 'INSURANCE_AMOUNT':
      return Number(doc.insurance_amount ?? 0)
    case 'DISCOUNT_AMOUNT':
      return Number(doc.discount_amount ?? 0)
    case 'OTHER_EXPENSES_AMOUNT':
      return Number(doc.other_expenses_amount ?? 0)
    case 'ICMS_AMOUNT':
      return Number(doc.icms_amount ?? 0)
    case 'IPI_AMOUNT':
      return Number(doc.ipi_amount ?? 0)
    case 'PIS_AMOUNT':
      return Number(doc.pis_amount ?? 0)
    case 'COFINS_AMOUNT':
      return Number(doc.cofins_amount ?? 0)
    case 'ISS_AMOUNT':
      return Number(doc.iss_amount ?? 0)
    case 'TOTAL_AMOUNT':
    case 'DOCUMENT_AMOUNT':
    default:
      return Number(doc.document_amount ?? 0)
  }
}

export function renderAccountingMemo(template: string | null | undefined, doc: AccountingMemoSource, fallback: string): string {
  if (!template) return fallback

  const partnerName = doc.partner?.name || doc.partner_name || ''
  const rendered = template
    .replaceAll('{numero}', String(doc.number || ''))
    .replaceAll('{documento}', String(doc.number || doc.id || ''))
    .replaceAll('{parceiro}', String(partnerName))
    .replaceAll('{valor}', String(doc.document_amount ?? ''))
    .trim()

  return rendered || fallback
}

export function legacyLinesFromRule(rule: FiscalAccountingRule): FiscalAccountingRuleLine[] {
  return [
    {
      id: `legacy-debit-${rule.id}`,
      rule_id: rule.id,
      line_order: 1,
      debit_credit: 'DEBIT',
      account_source: rule.debit_account_source,
      account_id: rule.debit_account_id,
      value_base: rule.value_base,
      amount_multiplier: 1,
      memo_template: rule.description_template,
      account: rule.debit_account || null
    },
    {
      id: `legacy-credit-${rule.id}`,
      rule_id: rule.id,
      line_order: 2,
      debit_credit: 'CREDIT',
      account_source: rule.credit_account_source,
      account_id: rule.credit_account_id,
      value_base: rule.value_base,
      amount_multiplier: 1,
      memo_template: rule.description_template,
      account: rule.credit_account || null
    }
  ]
}

export function normalizedRuleLines(rule: FiscalAccountingRule): FiscalAccountingRuleLine[] {
  if (rule.lines?.length) {
    return [...rule.lines].sort((a, b) => a.line_order - b.line_order)
  }
  return legacyLinesFromRule(rule)
}
