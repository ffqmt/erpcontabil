import { getClient } from '@/lib/supabase/server'
import { FiscalDocument, FiscalDashboardData } from './types'
import { listFiscalPendencies } from './validation-issues/queries'

async function getDb() {
  return getClient()
}

const DOCUMENT_SELECT = `
  id, workspace_id, company_id, establishment_id, partner_id, fiscal_operation_nature_id,
  direction, document_type, operation_type, number, series, access_key, issue_date,
  operation_date, competence, due_date, document_amount, merchandise_amount,
  services_amount, freight_amount, insurance_amount, discount_amount,
  other_expenses_amount, icms_base, icms_rate, icms_amount, iss_base, iss_rate,
  iss_amount, pis_base, pis_rate, pis_amount, cofins_base, cofins_rate,
  cofins_amount, status, accounting_status, tax_status, source, journal_entry_id,
  notes, created_at, updated_at,
  partner:partners(name),
  fiscal_operation_nature:fiscal_operation_natures(code, name, direction),
  journal_entry:journal_entries(number, status)
`

const FISCAL_DOCUMENT_LIST_LIMIT = 100

export async function getFiscalDashboard(companyId: string, competence: string): Promise<FiscalDashboardData> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida para o painel fiscal.')

  const db = await getDb()
  const competenceStart = `${competence.substring(0, 7)}-01`

  const { data: docs, error } = await db
    .from('fiscal_documents')
    .select('direction, document_amount, status, accounting_status')
    .eq('company_id', companyId)
    .eq('competence', competenceStart)

  if (error) throw new Error(error.message || 'Falha ao buscar documentos fiscais.')

  const rows = docs || []
  let inboundTotal = 0
  let outboundTotal = 0
  let draftCount = 0
  let validatedCount = 0
  let bookedCount = 0
  let notAccountedCount = 0
  let cancelledCount = 0

  rows.forEach((d: any) => {
    const amt = typeof d.document_amount === 'string' ? parseFloat(d.document_amount) : d.document_amount
    if (d.status !== 'CANCELLED') {
      if (d.direction === 'IN') inboundTotal += amt || 0
      else outboundTotal += amt || 0
    }
    if (d.status === 'DRAFT' || d.status === 'IMPORTED') draftCount++
    if (d.status === 'VALIDATED') validatedCount++
    if (d.status === 'BOOKED') bookedCount++
    if (d.status === 'CANCELLED') cancelledCount++
    if (d.status !== 'CANCELLED' && d.accounting_status === 'NOT_ACCOUNTED') notAccountedCount++
  })

  return {
    documentsThisMonth: rows.length,
    draftCount,
    validatedCount,
    bookedCount,
    notAccountedCount,
    cancelledCount,
    inboundTotal,
    outboundTotal
  }
}

export async function listFiscalDocuments(companyId: string, filters: {
  direction?: string
  status?: string
  competence?: string
  text?: string
  hasPendencies?: boolean
  notAccounted?: boolean
  notAssessed?: boolean
  noProduct?: boolean
  hasXmlWarnings?: boolean
  limit?: number
} = {}): Promise<FiscalDocument[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')

  const db = await getDb()
  let query = db.from('fiscal_documents').select(DOCUMENT_SELECT).eq('company_id', companyId)

  if (filters.direction) query = query.eq('direction', filters.direction)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.competence) query = query.eq('competence', `${filters.competence.substring(0, 7)}-01`)
  if (filters.text) query = query.or(`number.ilike.%${filters.text}%,notes.ilike.%${filters.text}%`)

  const { data, error } = await query
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? FISCAL_DOCUMENT_LIST_LIMIT)
  if (error) throw new Error(error.message || 'Falha ao buscar documentos fiscais.')

  let documents = (data || []) as unknown as FiscalDocument[]
  const ids = documents.map((d) => d.id)
  if (ids.length === 0) return documents

  // Conta quantas aplicações contábeis ATIVAS (status='APPLIED') cada documento tem — o
  // normal é 1; mais de 1 é sinal de contabilização duplicada (bug de corrida corrigido em
  // erp_schema_v2_7, mas dados antigos podem ainda estar assim até a limpeza rodar).
  const { data: applications } = await db
    .from('fiscal_accounting_applications')
    .select('fiscal_document_id')
    .eq('company_id', companyId)
    .eq('status', 'APPLIED')
    .in('fiscal_document_id', ids)

  const counts = new Map<string, number>()
  ;(applications || []).forEach((a: { fiscal_document_id: string }) => {
    counts.set(a.fiscal_document_id, (counts.get(a.fiscal_document_id) || 0) + 1)
  })

  documents = documents.map((doc) => ({ ...doc, active_accounting_application_count: counts.get(doc.id) || 0 }))

  // Etapa 35B: contagem de pendências abertas por documento, exibida como indicador
  // compacto na listagem — reaproveita o mesmo motor de regras da central de pendências,
  // não duplica lógica de detecção aqui.
  const pendencies = await listFiscalPendencies(companyId, { fiscalDocumentIds: ids })
  const openNotAccountedIds = new Set<string>()
  const openNotAssessedIds = new Set<string>()
  const openByDocument = new Map<string, { total: number; hasNoProduct: boolean; hasXmlWarning: boolean }>()
  pendencies.filter((p) => p.status === 'OPEN').forEach((p) => {
    const entry = openByDocument.get(p.fiscalDocumentId) || { total: 0, hasNoProduct: false, hasXmlWarning: false }
    entry.total += 1
    if (p.issueType === 'ITEM_WITHOUT_PRODUCT' || p.issueType === 'LOW_CONFIDENCE_MATCH') entry.hasNoProduct = true
    if (p.documentSource === 'XML' && (p.issueType === 'NFSE_RETENTION_REVIEW' || p.issueType === 'CTE_PIS_COFINS_NOT_EXTRACTED' || p.issueType === 'BOOKKEEPING_CFOP_MISSING')) entry.hasXmlWarning = true
    if (p.issueType === 'NOT_ACCOUNTED') openNotAccountedIds.add(p.fiscalDocumentId)
    if (p.issueType === 'NOT_ASSESSED') openNotAssessedIds.add(p.fiscalDocumentId)
    openByDocument.set(p.fiscalDocumentId, entry)
  })

  documents = documents.map((doc) => ({
    ...doc,
    open_pendency_count: openByDocument.get(doc.id)?.total || 0,
    has_no_product_pendency: openByDocument.get(doc.id)?.hasNoProduct || false,
    has_xml_warning_pendency: openByDocument.get(doc.id)?.hasXmlWarning || false
  }))

  if (filters.hasPendencies) documents = documents.filter((doc) => (doc.open_pendency_count || 0) > 0)
  if (filters.notAccounted) documents = documents.filter((doc) => openNotAccountedIds.has(doc.id))
  if (filters.notAssessed) documents = documents.filter((doc) => openNotAssessedIds.has(doc.id))
  if (filters.noProduct) documents = documents.filter((doc) => doc.has_no_product_pendency)
  if (filters.hasXmlWarnings) documents = documents.filter((doc) => doc.has_xml_warning_pendency)

  return documents
}

export async function getFiscalDocumentById(id: string, companyId: string): Promise<FiscalDocument | null> {
  if (!id || !companyId) throw new Error('ID de documento e empresa ativa são obrigatórios.')

  const db = await getDb()
  const { data: doc, error } = await db
    .from('fiscal_documents')
    .select(DOCUMENT_SELECT)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Falha ao buscar o documento fiscal.')
  if (!doc) return null

  const [{ data: items }, { data: retentions }] = await Promise.all([
    db.from('fiscal_document_items').select('*').eq('fiscal_document_id', id).eq('company_id', companyId).order('line_number', { ascending: true }),
    db.from('fiscal_document_retentions').select('*').eq('fiscal_document_id', id).eq('company_id', companyId)
  ])

  return { ...(doc as any), items: items || [], retentions: retentions || [] } as FiscalDocument
}

/**
 * Linhas de apuração tributária que citam este documento fiscal como origem — usadas na
 * aba "Apuração Tributária" da tela do documento (Etapa 32C.6/34A).
 */
export async function getFiscalDocumentTaxAssessmentLines(fiscalDocumentId: string, companyId: string) {
  if (!fiscalDocumentId || !companyId) return []
  const db = await getDb()
  const { data, error } = await db
    .from('tax_assessment_lines')
    .select('id, description, base_amount, tax_rate, amount, line_type, tax_assessment:tax_assessments(id, tax_type, competence, status)')
    .eq('fiscal_document_id', fiscalDocumentId)
    .eq('company_id', companyId)
  if (error) throw new Error(error.message || 'Falha ao buscar linhas de apuração tributária do documento.')
  return data || []
}

/**
 * Bens patrimoniais criados a partir deste documento fiscal — usados na aba "Patrimônio"
 * da tela do documento (Etapa 33A).
 */
export async function getFiscalDocumentFixedAssets(fiscalDocumentId: string, companyId: string) {
  if (!fiscalDocumentId || !companyId) return []
  const db = await getDb()
  const { data, error } = await db
    .from('fixed_assets')
    .select('id, code, description, acquisition_amount, status, fiscal_document_item_id')
    .eq('fiscal_document_id', fiscalDocumentId)
    .eq('company_id', companyId)
  if (error) throw new Error(error.message || 'Falha ao buscar bens patrimoniais do documento.')
  return data || []
}

/**
 * Registro de auditoria da importação de XML que originou este documento (se houver) —
 * usado na aba "XML/Auditoria" (Etapa 32B/32C.6).
 */
export async function getFiscalXmlImportForDocument(fiscalDocumentId: string, companyId: string) {
  if (!fiscalDocumentId || !companyId) return null
  const db = await getDb()
  const { data, error } = await db
    .from('fiscal_xml_imports')
    .select('id, file_name, access_key, import_hash, import_status, parse_errors, created_at')
    .eq('fiscal_document_id', fiscalDocumentId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Falha ao buscar a importação de XML de origem.')
  return data
}
