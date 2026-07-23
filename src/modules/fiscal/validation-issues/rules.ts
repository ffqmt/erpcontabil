import { ValidationIssueType, SuggestedAction } from './types'

export interface RuleDocumentItem {
  id: string
  item_type: string
  ncm: string | null
  cfop: string | null
  xml_cfop: string | null
  cst_icms: string | null
  csosn: string | null
  ipi_amount: number | string | null
}

export interface RuleDocumentNature {
  requiresNcm: boolean
  requiresProduct: boolean
  defaultTaxSituation: string | null
}

export interface RuleDocument {
  id: string
  document_type: string
  direction: 'IN' | 'OUT'
  status: string
  accounting_status: string
  tax_status: string
  partner_id: string | null
  establishment_id: string | null
  fiscal_operation_nature_id: string | null
  icms_amount: number | string | null
  iss_amount: number | string | null
  pis_amount: number | string | null
  cofins_amount: number | string | null
  items: RuleDocumentItem[]
  // Etapa 35B.1-A: dados da Natureza Fiscal do documento (quando definida), usados para
  // enriquecer mensagens/sugestões — ver docs/especificacao-fluxo-fiscal-operacional-35b1.md.
  nature: RuleDocumentNature | null
}

export interface RuleContext {
  establishmentsCount: number
  retentionsCountByDocument: Map<string, number>
}

export interface DynamicIssueCandidate {
  issueType: ValidationIssueType
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  message: string
  fiscalDocumentItemId: string | null
  suggestedAction: SuggestedAction
}

const ENTRY_CFOP_PREFIXES = ['1', '2', '3']
const EXIT_CFOP_PREFIXES = ['5', '6', '7']

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'string' ? parseFloat(value) : value
  return Number.isFinite(n) ? n : 0
}

function itemLabel(item: RuleDocumentItem): string {
  return item.id.slice(0, 8)
}

/**
 * Etapa 35B: motor de validacoes leves e nao-bloqueantes. Todas as regras aqui sao
 * derivadas do estado ATUAL do documento — nada e persistido por esta funcao (a camada de
 * queries.ts decide o que persistir/ignorar). Documentos CANCELLED nunca entram aqui (quem
 * chama filtra antes) — um documento cancelado nao gera pendencia de escrituracao.
 *
 * Etapa 35B.1-A: CFOP_DIRECTION_MISMATCH compara "cfop" (escrituração), NUNCA "xml_cfop"
 * (origem) — a partir desta subetapa a importação de XML só preenche "cfop" quando uma Regra
 * de Importação resolveu; sem regra, "cfop" fica em branco e BOOKKEEPING_CFOP_MISSING assume
 * (em vez do falso-positivo estrutural de comparar o CFOP do emitente contra a direção do
 * destinatário — ver docs/especificacao-fluxo-fiscal-operacional-35b1.md, Seção 1.4).
 */
export function computeDocumentIssues(doc: RuleDocument, ctx: RuleContext): DynamicIssueCandidate[] {
  const issues: DynamicIssueCandidate[] = []
  const items = doc.items || []

  if (items.length === 0) {
    issues.push({
      issueType: 'NO_ITEMS',
      severity: 'CRITICAL',
      message: 'Documento sem nenhum item lançado.',
      fiscalDocumentItemId: null,
      suggestedAction: 'OPEN_DOCUMENT'
    })
  }

  for (const item of items) {
    const requiresCfop = item.item_type === 'PRODUCT' || item.item_type === 'ASSET' || item.item_type === 'FREIGHT'
    // Etapa 35B.1-A: requires_ncm da Natureza Fiscal é ADITIVO (pode EXIGIR NCM além do que o
    // tipo de item já exige), nunca SUPRESSIVO — o campo nasce com default false em toda
    // natureza (inclusive as já cadastradas antes desta etapa), e tratá-lo como "false
    // suprime o aviso" desligaria o aviso de NCM pra quase todo mundo sem ninguém ter pedido
    // isso. Documentado em docs/implementacao-35b1a-motor-fiscal-natureza-regras-
    // importacao.md.
    const requiresNcm = item.item_type === 'PRODUCT' || item.item_type === 'ASSET' || doc.nature?.requiresNcm === true
    const requiresIcmsSituation = item.item_type === 'PRODUCT' || item.item_type === 'ASSET'

    if (requiresCfop && !item.cfop && !item.xml_cfop) {
      issues.push({
        issueType: 'CFOP_MISSING',
        severity: 'WARNING',
        message: `Item ${itemLabel(item)} sem CFOP.`,
        fiscalDocumentItemId: item.id,
        suggestedAction: 'OPEN_DOCUMENT'
      })
    }

    if (requiresCfop && !item.cfop && item.xml_cfop) {
      issues.push({
        issueType: 'BOOKKEEPING_CFOP_MISSING',
        severity: 'WARNING',
        message: `Este item ainda não tem CFOP de escrituração definido. CFOP original do XML: ${item.xml_cfop}.`,
        fiscalDocumentItemId: item.id,
        suggestedAction: 'OPEN_DOCUMENT'
      })
    }

    if (item.cfop) {
      const prefix = item.cfop.trim().charAt(0)
      const looksLikeEntry = ENTRY_CFOP_PREFIXES.includes(prefix)
      const looksLikeExit = EXIT_CFOP_PREFIXES.includes(prefix)
      if (doc.direction === 'IN' && looksLikeExit) {
        issues.push({
          issueType: 'CFOP_DIRECTION_MISMATCH',
          severity: 'WARNING',
          message: `CFOP de escrituração ${item.cfop} parece ser de saída, mas o documento é de entrada.`,
          fiscalDocumentItemId: item.id,
          suggestedAction: 'OPEN_DOCUMENT'
        })
      } else if (doc.direction === 'OUT' && looksLikeEntry) {
        issues.push({
          issueType: 'CFOP_DIRECTION_MISMATCH',
          severity: 'WARNING',
          message: `CFOP de escrituração ${item.cfop} parece ser de entrada, mas o documento é de saída.`,
          fiscalDocumentItemId: item.id,
          suggestedAction: 'OPEN_DOCUMENT'
        })
      }
    }

    if (requiresNcm && !item.ncm) {
      issues.push({
        issueType: 'NCM_MISSING',
        severity: 'WARNING',
        message: `Item ${itemLabel(item)} de mercadoria/ativo sem NCM.`,
        fiscalDocumentItemId: item.id,
        suggestedAction: 'OPEN_DOCUMENT'
      })
    }

    if (requiresIcmsSituation && !item.cst_icms && !item.csosn) {
      const suggestion = doc.nature?.defaultTaxSituation ? ` Sugestão da Natureza Fiscal: ${doc.nature.defaultTaxSituation}.` : ''
      issues.push({
        issueType: 'TAX_SITUATION_CODE_MISSING',
        severity: 'WARNING',
        message: `Item ${itemLabel(item)} sem CST/CSOSN de ICMS.${suggestion}`,
        fiscalDocumentItemId: item.id,
        suggestedAction: 'OPEN_DOCUMENT'
      })
    }
  }

  if (!doc.fiscal_operation_nature_id) {
    issues.push({
      issueType: 'FISCAL_NATURE_MISSING',
      severity: 'WARNING',
      message: 'Escolha a Natureza Fiscal desta operação para o sistema sugerir CFOP, CST e tributos automaticamente.',
      fiscalDocumentItemId: null,
      suggestedAction: 'OPEN_DOCUMENT'
    })
  }

  if (!doc.partner_id) {
    issues.push({
      issueType: 'PARTNER_MISSING',
      severity: 'WARNING',
      message: 'Documento sem parceiro (cliente/fornecedor) vinculado.',
      fiscalDocumentItemId: null,
      suggestedAction: 'OPEN_DOCUMENT'
    })
  }

  if (!doc.establishment_id && ctx.establishmentsCount > 1) {
    issues.push({
      issueType: 'ESTABLISHMENT_MISSING',
      severity: 'WARNING',
      message: 'Empresa possui múltiplos estabelecimentos e este documento não tem estabelecimento definido.',
      fiscalDocumentItemId: null,
      suggestedAction: 'OPEN_DOCUMENT'
    })
  }

  if (doc.status !== 'DRAFT' && doc.accounting_status === 'NOT_ACCOUNTED') {
    issues.push({
      issueType: 'NOT_ACCOUNTED',
      severity: 'INFO',
      message: 'Documento ainda não contabilizado.',
      fiscalDocumentItemId: null,
      suggestedAction: 'GO_ACCOUNTING'
    })
  }

  const hasAssessableTax = toNumber(doc.icms_amount) > 0 || toNumber(doc.iss_amount) > 0 || items.some((i) => toNumber(i.ipi_amount) > 0)
  if (doc.status === 'BOOKED' && doc.tax_status === 'NOT_ASSESSED' && hasAssessableTax) {
    issues.push({
      issueType: 'NOT_ASSESSED',
      severity: 'INFO',
      message: 'Documento com tributo apurável ainda fora de apuração.',
      fiscalDocumentItemId: null,
      suggestedAction: 'GO_ASSESSMENT'
    })
  }

  if (doc.document_type === 'NFSE') {
    const retentionsCount = ctx.retentionsCountByDocument.get(doc.id) || 0
    if (retentionsCount === 0) {
      issues.push({
        issueType: 'NFSE_RETENTION_REVIEW',
        severity: 'WARNING',
        message: 'NFS-e importada por parser tolerante. Revise manualmente ISS/INSS/IRRF/PIS/COFINS/CSLL retidos.',
        fiscalDocumentItemId: null,
        suggestedAction: 'OPEN_DOCUMENT'
      })
    }
  }

  if (doc.document_type === 'CTE' || doc.document_type === 'CTE_OS') {
    if (!toNumber(doc.pis_amount) && !toNumber(doc.cofins_amount)) {
      issues.push({
        issueType: 'CTE_PIS_COFINS_NOT_EXTRACTED',
        severity: 'WARNING',
        message: 'CT-e importado com ICMS extraído. Revise PIS/COFINS quando aplicável.',
        fiscalDocumentItemId: null,
        suggestedAction: 'OPEN_DOCUMENT'
      })
    }
  }

  return issues
}
