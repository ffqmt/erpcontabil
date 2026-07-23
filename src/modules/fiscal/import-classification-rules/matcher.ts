import { FiscalImportClassificationRule, MatchableDocumentContext, MatchableItemContext, RuleApplicationResult } from './types'

function normalizeDigits(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function equalsOrWildcard(value: string | null, ruleValue: string | null | undefined): boolean {
  if (!ruleValue) return true
  if (!value) return false
  return value === ruleValue
}

function patternMatches(value: string | null, pattern: string | null | undefined): boolean {
  if (!pattern) return true
  if (!value) return false
  return value.startsWith(pattern)
}

function descriptionMatches(value: string | null, pattern: string | null | undefined): boolean {
  if (!pattern) return true
  if (!value) return false
  return value.toLowerCase().includes(pattern.toLowerCase())
}

/**
 * Etapa 35B.1-A: motor de casamento das Regras de Importação XML. Mesmo espírito das Regras
 * Contábeis Fiscais (32C) — condição nula é coringa — mas com condições de valor único (não
 * arrays), conforme escopo fechado da especificação. Ordem de desempate EXPLICITAMENTE pedida
 * nesta subetapa: priority menor ganha primeiro; especificidade (nº de condições preenchidas)
 * só desempata quando a priority é igual — ordem inversa da usada pelas Regras Contábeis
 * Fiscais (lá especificidade vem primeiro). Documentado aqui para não ser confundido com bug.
 */
function ruleMatches(rule: FiscalImportClassificationRule, doc: MatchableDocumentContext, item: MatchableItemContext): boolean {
  if (!rule.active) return false
  if (!equalsOrWildcard(doc.partnerId, rule.partner_id)) return false
  if (!equalsOrWildcard(doc.issuerCnpjNormalized, normalizeDigits(rule.issuer_cnpj))) return false
  if (!patternMatches(item.xmlCfop, rule.xml_cfop_pattern)) return false
  if (!patternMatches(item.ncm, rule.ncm_pattern)) return false
  if (!equalsOrWildcard(item.cest, rule.cest)) return false
  // rule.item_id NÃO é usado como filtro aqui de propósito: na importação de XML o item
  // interno ainda não é conhecido no momento do match (é exatamente o que a regra pode ajudar a
  // resolver, via create_partner_item_mapping) — se fosse condição, uma regra com item_id
  // preenchido nunca casaria neste fluxo, e a ação de mapeamento nunca seria alcançada. Aqui
  // rule.item_id funciona como alvo da ação (ver buildRuleApplication/targetItemId), não
  // como condição de entrada. Documentado em docs/implementacao-35b1a-motor-fiscal-natureza-
  // regras-importacao.md.
  if (!equalsOrWildcard(item.supplierProductCode, rule.supplier_product_code)) return false
  if (!descriptionMatches(item.supplierDescription, rule.supplier_description_pattern)) return false
  if (!equalsOrWildcard(doc.documentType, rule.document_type)) return false
  if (!equalsOrWildcard(doc.direction, rule.direction)) return false
  if (!equalsOrWildcard(doc.originState, rule.origin_state)) return false
  if (!equalsOrWildcard(doc.destinationState, rule.destination_state)) return false
  if (!equalsOrWildcard(doc.municipalityCode, rule.municipality_code)) return false

  if (rule.min_amount !== null && rule.min_amount !== undefined && item.amount < Number(rule.min_amount)) return false
  if (rule.max_amount !== null && rule.max_amount !== undefined && item.amount > Number(rule.max_amount)) return false

  return true
}

function specificityScore(rule: FiscalImportClassificationRule): number {
  const conditionFields: Array<unknown> = [
    rule.partner_id, rule.issuer_cnpj, rule.xml_cfop_pattern, rule.ncm_pattern, rule.cest,
    rule.supplier_product_code, rule.supplier_description_pattern,
    rule.document_type, rule.direction, rule.origin_state, rule.destination_state, rule.municipality_code
  ]
  let score = conditionFields.filter(Boolean).length
  if (rule.min_amount !== null && rule.min_amount !== undefined) score++
  if (rule.max_amount !== null && rule.max_amount !== undefined) score++
  return score
}

export function findMatchingImportRule(
  rules: FiscalImportClassificationRule[],
  doc: MatchableDocumentContext,
  item: MatchableItemContext
): FiscalImportClassificationRule | null {
  const candidates = rules.filter((rule) => ruleMatches(rule, doc, item))
  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    const prioDiff = a.priority - b.priority
    if (prioDiff !== 0) return prioDiff
    return specificityScore(b) - specificityScore(a)
  })

  return candidates[0]
}

export function buildRuleApplication(rule: FiscalImportClassificationRule): RuleApplicationResult {
  const appliedFields: string[] = []
  if (rule.fiscal_operation_nature_id) appliedFields.push('naturezaFiscal')
  if (rule.bookkeeping_cfop) appliedFields.push('cfopEscrituracao')
  if (rule.tax_situation_code) appliedFields.push('cstCsosn')
  if (rule.item_fiscal_usage) appliedFields.push('usoFiscalItem')
  if (rule.item_kind) appliedFields.push('tipoItem')
  if (rule.generates_credit !== null && rule.generates_credit !== undefined) appliedFields.push('geraCredito')
  if (rule.expected_retentions && rule.expected_retentions.length > 0) appliedFields.push('retencoesEsperadas')
  if (rule.create_partner_item_mapping) appliedFields.push('mapeamentoFornecedorProduto')

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    appliedFields,
    fiscalOperationNatureId: rule.fiscal_operation_nature_id,
    bookkeepingCfop: rule.bookkeeping_cfop,
    taxSituationCode: rule.tax_situation_code,
    itemFiscalUsage: rule.item_fiscal_usage,
    itemKind: rule.item_kind,
    generatesCredit: rule.generates_credit,
    expectedRetentions: rule.expected_retentions,
    createPartnerItemMapping: rule.create_partner_item_mapping,
    targetItemId: rule.item_id
  }
}
