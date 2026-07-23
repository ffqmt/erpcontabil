export interface FiscalImportClassificationRule {
  id: string
  workspace_id: string
  company_id: string
  name: string
  description: string | null
  priority: number
  active: boolean

  partner_id: string | null
  issuer_cnpj: string | null
  xml_cfop_pattern: string | null
  ncm_pattern: string | null
  cest: string | null
  item_id: string | null
  supplier_product_code: string | null
  supplier_description_pattern: string | null
  document_type: string | null
  direction: 'IN' | 'OUT' | null
  origin_state: string | null
  destination_state: string | null
  municipality_code: string | null
  min_amount: number | string | null
  max_amount: number | string | null

  fiscal_operation_nature_id: string | null
  bookkeeping_cfop: string | null
  tax_situation_code: string | null
  item_fiscal_usage: string | null
  item_kind: string | null
  generates_credit: boolean | null
  expected_retentions: string[] | null
  create_partner_item_mapping: boolean

  created_at: string
  updated_at: string

  partner?: { id: string; name: string } | null
  fiscal_operation_nature?: { id: string; code: string; name: string } | null
}

// Contexto do DOCUMENTO no momento da importação — compartilhado por todos os itens dele.
export interface MatchableDocumentContext {
  partnerId: string | null
  issuerCnpjNormalized: string | null
  documentType: string
  direction: 'IN' | 'OUT'
  originState: string | null
  destinationState: string | null
  municipalityCode: string | null
}

// Contexto do ITEM — varia linha a linha dentro do mesmo documento.
export interface MatchableItemContext {
  xmlCfop: string | null
  ncm: string | null
  cest: string | null
  itemId: string | null
  supplierProductCode: string | null
  supplierDescription: string | null
  amount: number
}

export interface RuleApplicationResult {
  ruleId: string
  ruleName: string
  appliedFields: string[]
  fiscalOperationNatureId: string | null
  bookkeepingCfop: string | null
  taxSituationCode: string | null
  itemFiscalUsage: string | null
  itemKind: string | null
  generatesCredit: boolean | null
  expectedRetentions: string[] | null
  createPartnerItemMapping: boolean
  // Etapa 35B.1-A: rule.item_id serve de alvo para create_partner_item_mapping (o produto
  // interno ao qual o código do fornecedor deve ser mapeado) — não é usado como filtro de
  // correspondência no matcher hoje (o item interno ainda não é conhecido na primeira
  // passagem da importação).
  targetItemId: string | null
}
