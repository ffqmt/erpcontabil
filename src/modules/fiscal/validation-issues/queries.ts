import { getClient } from '@/lib/supabase/server'
import { computeDocumentIssues, RuleDocument } from './rules'
import { FiscalPendency, PendencyCounters, PendencyFilters, PendencyIssueType, PendencySeverity, PendencyStatus, SuggestedAction } from './types'

async function getDb() {
  return getClient()
}

const PENDENCY_DOCUMENT_LIMIT = 200
const PENDENCY_DOCUMENT_IDS_LIMIT = 500
const PENDENCY_REVIEW_ISSUE_LIMIT = 1000

const REVIEW_ISSUE_MESSAGES: Record<string, string> = {
  ITEM_WITHOUT_PRODUCT: 'Este item do fornecedor ainda não está ligado a um produto seu — depois de vincular uma vez, a próxima compra do mesmo fornecedor já reconhece sozinha.',
  LOW_CONFIDENCE_MATCH: 'Item vinculado por match de baixa confiança — confirme manualmente.'
}

function mapReviewSeverity(severity: string): PendencySeverity {
  if (severity === 'BLOCKING') return 'CRITICAL'
  if (severity === 'INFO') return 'INFO'
  return 'WARNING'
}

/**
 * Etapa 35B: motor de leitura da central de pendencias fiscais. Combina tres fontes:
 * 1) fiscal_document_item_review_issues (35A) — pendencia de item sem produto/match fraco;
 * 2) candidatos dinamicos calculados agora por rules.ts a partir do estado atual do
 *    documento (CFOP/NCM/CST/natureza/parceiro/itens/contabilizacao/apuracao/NFS-e/CT-e/
 *    estabelecimento);
 * 3) overrides persistidos em fiscal_document_validation_issues — só existem quando um
 *    usuário clicou "Ignorar" ou "Marcar resolvida" para um candidato dinâmico específico.
 * Nada é escrito aqui — esta função é somente leitura.
 */
export async function listFiscalPendencies(companyId: string, filters: PendencyFilters = {}): Promise<FiscalPendency[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')
  const db = await getDb()
  const scopedDocumentIds = Array.from(new Set(filters.fiscalDocumentIds || []))
    .filter(Boolean)
    .slice(0, PENDENCY_DOCUMENT_IDS_LIMIT)

  let docQuery = db
    .from('fiscal_documents')
    .select(`
      id, document_type, direction, status, accounting_status, tax_status, partner_id,
      establishment_id, fiscal_operation_nature_id, icms_amount, iss_amount, pis_amount,
      cofins_amount, number, issue_date, competence, source,
      partner:partners(id, name),
      fiscal_operation_nature:fiscal_operation_natures(id, requires_ncm, requires_product, default_tax_situation),
      items:fiscal_document_items(id, item_type, ncm, cfop, xml_cfop, cst_icms, csosn, ipi_amount)
    `)
    .eq('company_id', companyId)
    .neq('status', 'CANCELLED')

  if (filters.competence) docQuery = docQuery.eq('competence', `${filters.competence.substring(0, 7)}-01`)
  if (filters.documentType) docQuery = docQuery.eq('document_type', filters.documentType)
  if (filters.direction) docQuery = docQuery.eq('direction', filters.direction)
  if (filters.partnerId) docQuery = docQuery.eq('partner_id', filters.partnerId)
  if (filters.fiscalDocumentId) {
    docQuery = docQuery.eq('id', filters.fiscalDocumentId)
  } else if (scopedDocumentIds.length > 0) {
    docQuery = docQuery.in('id', scopedDocumentIds)
  }

  docQuery = docQuery.order('issue_date', { ascending: false }).order('created_at', { ascending: false })
  if (!filters.fiscalDocumentId && scopedDocumentIds.length === 0) {
    docQuery = docQuery.limit(filters.limit ?? PENDENCY_DOCUMENT_LIMIT)
  }

  const { data: docs, error: docsError } = await docQuery
  if (docsError) throw new Error(docsError.message || 'Falha ao buscar documentos fiscais para a central de pendências.')

  const documents = (docs || []) as any[]
  const docIds = documents.map((d) => d.id)
  const documentById = new Map<string, any>(documents.map((d) => [d.id, d]))

  const [establishmentsResult, retentionRows, overrideRows, reviewIssueRows] = await Promise.all([
    db.from('establishments').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('active', true),
    docIds.length > 0
      ? db.from('fiscal_document_retentions').select('fiscal_document_id').eq('company_id', companyId).in('fiscal_document_id', docIds)
      : Promise.resolve({ data: [] as any[] }),
    docIds.length > 0
      ? db
          .from('fiscal_document_validation_issues')
          .select('id, fiscal_document_id, fiscal_document_item_id, issue_type, severity, status, message, created_at, resolved_at')
          .eq('company_id', companyId)
          .in('fiscal_document_id', docIds)
      : Promise.resolve({ data: [] as any[] }),
    (async () => {
      let q = db
        .from('fiscal_document_item_review_issues')
        .select(`
          id, issue_type, severity, status, created_at, resolved_at, fiscal_document_id, fiscal_document_item_id,
          fiscal_document:fiscal_documents!inner(number, document_type, direction, issue_date, competence, source, partner_id, company_id, status, partner:partners(id, name))
        `)
        .eq('company_id', companyId)
        .neq('fiscal_document.status', 'CANCELLED')
      if (filters.competence) q = q.eq('fiscal_document.competence', `${filters.competence.substring(0, 7)}-01`)
      if (filters.documentType) q = q.eq('fiscal_document.document_type', filters.documentType)
      if (filters.direction) q = q.eq('fiscal_document.direction', filters.direction)
      if (filters.partnerId) q = q.eq('fiscal_document.partner_id', filters.partnerId)
      if (filters.fiscalDocumentId) {
        q = q.eq('fiscal_document_id', filters.fiscalDocumentId)
      } else if (scopedDocumentIds.length > 0) {
        q = q.in('fiscal_document_id', scopedDocumentIds)
      }
      q = q.order('created_at', { ascending: false })
      if (!filters.fiscalDocumentId) q = q.limit(PENDENCY_REVIEW_ISSUE_LIMIT)
      return q
    })()
  ])
  if ((establishmentsResult as any).error) throw new Error((establishmentsResult as any).error.message || 'Falha ao buscar estabelecimentos para a central de pendências.')
  if ((retentionRows as any).error) throw new Error((retentionRows as any).error.message || 'Falha ao buscar retenções para a central de pendências.')
  if ((overrideRows as any).error) throw new Error((overrideRows as any).error.message || 'Falha ao buscar overrides da central de pendências.')
  if ((reviewIssueRows as any).error) throw new Error((reviewIssueRows as any).error.message || 'Falha ao buscar pendências de revisão de itens.')

  const retentionsCountByDocument = new Map<string, number>()
  ;((retentionRows as any).data || []).forEach((r: any) => {
    retentionsCountByDocument.set(r.fiscal_document_id, (retentionsCountByDocument.get(r.fiscal_document_id) || 0) + 1)
  })

  const overrides = ((overrideRows as any).data || []) as any[]
  const overrideMap = new Map<string, any>()
  overrides.forEach((o) => {
    const key = `${o.fiscal_document_id}|${o.fiscal_document_item_id || ''}|${o.issue_type}`
    overrideMap.set(key, o)
  })
  const consumedOverrideKeys = new Set<string>()

  const pendencies: FiscalPendency[] = []

  for (const doc of documents) {
    const ruleDoc: RuleDocument = {
      id: doc.id,
      document_type: doc.document_type,
      direction: doc.direction,
      status: doc.status,
      accounting_status: doc.accounting_status,
      tax_status: doc.tax_status,
      partner_id: doc.partner_id,
      establishment_id: doc.establishment_id,
      fiscal_operation_nature_id: doc.fiscal_operation_nature_id,
      icms_amount: doc.icms_amount,
      iss_amount: doc.iss_amount,
      pis_amount: doc.pis_amount,
      cofins_amount: doc.cofins_amount,
      items: doc.items || [],
      nature: doc.fiscal_operation_nature
        ? {
            requiresNcm: !!doc.fiscal_operation_nature.requires_ncm,
            requiresProduct: !!doc.fiscal_operation_nature.requires_product,
            defaultTaxSituation: doc.fiscal_operation_nature.default_tax_situation || null
          }
        : null
    }

    const candidates = computeDocumentIssues(ruleDoc, {
      establishmentsCount: (establishmentsResult as any).count || 0,
      retentionsCountByDocument
    })

    for (const candidate of candidates) {
      const key = `${doc.id}|${candidate.fiscalDocumentItemId || ''}|${candidate.issueType}`
      const override = overrideMap.get(key)
      if (override) consumedOverrideKeys.add(key)

      pendencies.push({
        id: override?.id || `dyn:${key}`,
        origin: 'VALIDATION',
        issueType: candidate.issueType,
        severity: candidate.severity,
        status: (override?.status as PendencyStatus) || 'OPEN',
        message: override?.message || candidate.message,
        fiscalDocumentId: doc.id,
        fiscalDocumentItemId: candidate.fiscalDocumentItemId,
        documentNumber: doc.number,
        documentType: doc.document_type,
        direction: doc.direction,
        issueDate: doc.issue_date,
        competence: doc.competence,
        partnerId: doc.partner_id,
        partnerName: doc.partner?.name || null,
        documentSource: doc.source,
        suggestedAction: candidate.suggestedAction,
        createdAt: override?.created_at || null,
        resolvedAt: override?.resolved_at || null
      })
    }
  }

  // Overrides que ja nao correspondem a um candidato dinamico ainda ativo (ex.: usuario
  // ignorou um CFOP incompatível e depois corrigiu o CFOP) continuam aparecendo como
  // histórico quando o usuário filtra por status Ignorada/Resolvida.
  for (const o of overrides) {
    const key = `${o.fiscal_document_id}|${o.fiscal_document_item_id || ''}|${o.issue_type}`
    if (consumedOverrideKeys.has(key)) continue
    const doc = documentById.get(o.fiscal_document_id)
    if (!doc) continue
    pendencies.push({
      id: o.id,
      origin: 'VALIDATION',
      issueType: o.issue_type,
      severity: o.severity,
      status: o.status,
      message: o.message,
      fiscalDocumentId: o.fiscal_document_id,
      fiscalDocumentItemId: o.fiscal_document_item_id,
      documentNumber: doc.number,
      documentType: doc.document_type,
      direction: doc.direction,
      issueDate: doc.issue_date,
      competence: doc.competence,
      partnerId: doc.partner_id,
      partnerName: doc.partner?.name || null,
      documentSource: doc.source,
      suggestedAction: 'OPEN_DOCUMENT',
      createdAt: o.created_at,
      resolvedAt: o.resolved_at
    })
  }

  ;((reviewIssueRows as any).data || []).forEach((row: any) => {
    const fdoc = row.fiscal_document
    pendencies.push({
      id: row.id,
      origin: 'ITEM_MATCHING',
      issueType: row.issue_type,
      severity: mapReviewSeverity(row.severity),
      status: row.status,
      message: REVIEW_ISSUE_MESSAGES[row.issue_type] || 'Pendência de classificação de item.',
      fiscalDocumentId: row.fiscal_document_id,
      fiscalDocumentItemId: row.fiscal_document_item_id,
      documentNumber: fdoc?.number ?? null,
      documentType: fdoc?.document_type ?? '',
      direction: fdoc?.direction ?? 'IN',
      issueDate: fdoc?.issue_date ?? null,
      competence: fdoc?.competence ?? null,
      partnerId: fdoc?.partner_id ?? null,
      partnerName: fdoc?.partner?.name || null,
      documentSource: fdoc?.source ?? 'MANUAL',
      suggestedAction: 'REVIEW_ITEM' as SuggestedAction,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at
    })
  })

  return pendencies.filter((p) => {
    if (filters.severity && p.severity !== filters.severity) return false
    if (filters.status && p.status !== filters.status) return false
    if (filters.issueType && p.issueType !== filters.issueType) return false
    if (filters.origin === 'XML' && p.documentSource !== 'XML') return false
    if (filters.origin === 'MANUAL' && p.documentSource === 'XML') return false
    return true
  })
}

export function computePendencyCounters(pendencies: FiscalPendency[]): PendencyCounters {
  const open = pendencies.filter((p) => p.status === 'OPEN')
  const affectedDocuments = new Set(open.map((p) => p.fiscalDocumentId))
  return {
    critical: open.filter((p) => p.severity === 'CRITICAL').length,
    warning: open.filter((p) => p.severity === 'WARNING').length,
    info: open.filter((p) => p.severity === 'INFO').length,
    affectedDocuments: affectedDocuments.size
  }
}

export async function countOpenFiscalPendencies(companyId: string): Promise<number> {
  const all = await listFiscalPendencies(companyId, {})
  return all.filter((p) => p.status === 'OPEN').length
}
