'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageFiscal } from '@/lib/permissions/permissions'
import { createLinkedAccountForRole } from '@/modules/registrations/partners/actions'
import { parseNfeXml, ParsedNfeResult } from './nfe-parser'
import { parseCteXml } from './cte-parser'
import { parseNfseXml } from './nfse-parser'
import { previewFiscalXmlSchema, confirmFiscalXmlImportSchema, rejectFiscalXmlImportSchema, bulkImportFiscalXmlSchema } from './validations'
import { FiscalXmlPreview, BulkImportResultItem } from './types'
import { listActiveImportClassificationRulesForEngine } from '../import-classification-rules/queries'
import { findMatchingImportRule, buildRuleApplication } from '../import-classification-rules/matcher'
import { MatchableDocumentContext, MatchableItemContext, RuleApplicationResult } from '../import-classification-rules/types'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function normalizeDocument(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function merchandiseBaseFromParsed(parsed: ParsedNfeResult): number {
  const headerBase = Number(parsed.merchandiseAmount ?? 0)
  if (headerBase > 0) return headerBase
  return roundCurrency(parsed.items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0))
}

/**
 * Etapa 35A: antes, PIS/COFINS recuperável era recalculado com alíquota fixa no código
 * (1,65%/7,60%) para TODA NF-e de entrada, sem checar o regime tributário da empresa — só
 * faz sentido para Lucro Real não-cumulativo, e mesmo assim a alíquota pode variar. Agora
 * exige configuração explícita por empresa (pis_cofins_recovery_settings); sem configuração,
 * o XML é importado com os valores como vieram, sem recálculo, e gera um aviso — nunca
 * adivinha alíquota.
 */
async function resolvePisCofinsRecoverySettings(db: any, companyId: string): Promise<{ pisRate: number; cofinsRate: number } | null> {
  const { data: company } = await db.from('companies').select('tax_regime').eq('id', companyId).single()
  if (company?.tax_regime !== 'LUCRO_REAL') return null

  const { data: settings } = await db
    .from('pis_cofins_recovery_settings')
    .select('enabled, pis_rate, cofins_rate')
    .eq('company_id', companyId)
    .maybeSingle()

  if (!settings || !settings.enabled) return null

  return { pisRate: Number(settings.pis_rate), cofinsRate: Number(settings.cofins_rate) }
}

function applyRecoverablePisCofinsForInboundNfe(parsed: ParsedNfeResult, recovery: { pisRate: number; cofinsRate: number } | null): ParsedNfeResult {
  const base = merchandiseBaseFromParsed(parsed)
  const warnings = [...parsed.warnings]

  if (!recovery) {
    if (base > 0) {
      warnings.push('PIS/COFINS recuperável não configurado para o regime desta empresa — os valores do XML foram mantidos sem recálculo. Configure em Fiscal > Configurações Tributárias se esta empresa tiver direito a crédito não-cumulativo, ou revise manualmente.')
    }
    return { ...parsed, warnings }
  }

  if (!(base > 0)) return parsed

  const xmlPisAmount = Number(parsed.pisAmount ?? 0)
  const xmlCofinsAmount = Number(parsed.cofinsAmount ?? 0)
  const pisAmount = roundCurrency(base * recovery.pisRate)
  const cofinsAmount = roundCurrency(base * recovery.cofinsRate)

  if (Math.abs(xmlPisAmount - pisAmount) > 0.009) {
    warnings.push(`PIS a recuperar recalculado sobre mercadorias conforme configuração da empresa: ${base.toFixed(2)} x ${(recovery.pisRate * 100).toFixed(2)}% = ${pisAmount.toFixed(2)}. O XML informava ${xmlPisAmount.toFixed(2)}.`)
  }
  if (Math.abs(xmlCofinsAmount - cofinsAmount) > 0.009) {
    warnings.push(`COFINS a recuperar recalculado sobre mercadorias conforme configuração da empresa: ${base.toFixed(2)} x ${(recovery.cofinsRate * 100).toFixed(2)}% = ${cofinsAmount.toFixed(2)}. O XML informava ${xmlCofinsAmount.toFixed(2)}.`)
  }

  return {
    ...parsed,
    warnings,
    merchandiseAmount: parsed.merchandiseAmount ?? base,
    pisBase: base,
    pisAmount,
    cofinsBase: base,
    cofinsAmount
  }
}

function competenceFirstDay(dateStr: string) {
  const parts = dateStr.split('-')
  return `${parts[0]}-${parts[1]}-01`
}

function revalidateFiscal() {
  revalidatePath('/fiscal')
  revalidatePath('/fiscal/documentos')
  revalidatePath('/fiscal/importar-xml')
  revalidatePath('/cadastros/parceiros')
  revalidatePath('/contabilidade/plano-contas')
}

interface AuditResult {
  xmlImportId: string
  parsed: ParsedNfeResult
  documentType: 'NFE' | 'CTE' | 'NFSE'
  direction: 'IN' | 'OUT' | null
  partner: FiscalXmlPreview['partner']
  duplicateOfFiscalDocumentId: string | null
  companyCnpjMismatch: boolean
  blockingErrors: string[]
}

/**
 * Detecta o tipo de documento fiscal a partir da raiz/tags do XML e chama o parser
 * correspondente (Etapa 32D). NF-e e CT-e têm tag raiz padronizada nacionalmente
 * (nfeProc/NFe e cteProc/CTe); NFS-e não tem — é o fallback quando nenhuma das duas
 * bate, então o parser tolerante de NFS-e tenta extrair o que conseguir por nome de tag.
 */
function detectDocumentType(xmlText: string): 'NFE' | 'CTE' | 'NFSE' {
  const hasTag = (tag: string) => new RegExp(`<${tag}[\\s>]`, 'i').test(xmlText)
  if (hasTag('nfeProc') || hasTag('NFe') || hasTag('infNFe')) return 'NFE'
  if (hasTag('cteProc') || hasTag('CTe') || hasTag('infCte')) return 'CTE'
  return 'NFSE'
}

function detectAndParseFiscalXml(xmlText: string): { documentType: 'NFE' | 'CTE' | 'NFSE'; parsed: ParsedNfeResult } {
  const documentType = detectDocumentType(xmlText)
  if (documentType === 'NFE') return { documentType, parsed: parseNfeXml(xmlText) }
  if (documentType === 'CTE') return { documentType, parsed: parseCteXml(xmlText) }
  return { documentType, parsed: parseNfseXml(xmlText) }
}

/**
 * Etapa 32D — determina a direção comparando o CNPJ da empresa ativa com emitente e
 * destinatário do XML: bate com o destinatário -> Entrada (empresa recebe, emitente vira
 * fornecedor); bate com o emitente -> Saída (empresa emite, destinatário vira cliente). Se
 * não bater com nenhum dos dois, null (bloqueia — MVP conservador, mesmo espírito da 32B).
 */
function resolveDirection(companyCnpjNormalized: string | null, emitDocNormalized: string | null, destDocNormalized: string | null): 'IN' | 'OUT' | null {
  if (!companyCnpjNormalized) return null
  if (destDocNormalized && companyCnpjNormalized === destDocNormalized) return 'IN'
  if (emitDocNormalized && companyCnpjNormalized === emitDocNormalized) return 'OUT'
  return null
}

interface HeaderInput {
  accessKey?: string
  documentNumber?: string
  series?: string
  issueDate: string
  operationDate: string
  emitCnpj: string
  emitName: string
  destCnpj?: string
  destCpf?: string
  destName?: string
  documentAmount: number
  merchandiseAmount?: number
  freightAmount?: number
  insuranceAmount?: number
  discountAmount?: number
  otherExpensesAmount?: number
  icmsBase?: number
  icmsAmount?: number
  pisAmount?: number
  cofinsAmount?: number
  ipiAmount?: number
  issBase?: number
  issAmount?: number
  notes?: string
}

interface ItemInput {
  lineNumber?: number
  description: string
  itemType: string
  quantity: number
  unit?: string
  unitPrice?: number
  totalAmount: number
  ncm?: string
  cfop?: string
  icmsAmount?: number
  ipiAmount?: number
  pisAmount?: number
  cofinsAmount?: number
  issAmount?: number
}

function itemTypeForImportedDocument(documentType: string, fallback: string): string {
  if (documentType === 'NFSE') return 'SERVICE'
  if (documentType === 'CTE') return 'FREIGHT'
  return fallback || 'PRODUCT'
}

// Etapa 35B.1-A: o código de situação tributária sugerido pela Regra de Importação
// (rule.tax_situation_code) não distingue CST (ICMS regime normal) de CSOSN (Simples
// Nacional) — heurística simples e documentada: CST-ICMS nacional sempre tem 2 dígitos
// (00, 10, 20...), CSOSN sempre tem 3 (101, 102...900). Sem isso, seria preciso o regime
// tributário da empresa neste ponto só para decidir em qual coluna gravar.
function taxSituationTargetField(code: string): 'cst_icms' | 'csosn' {
  return code.trim().length === 3 ? 'csosn' : 'cst_icms'
}

// =====================================================================================
// HELPERS COMPARTILHADOS — parseia+audita e grava o documento fiscal. Usados tanto pelo
// fluxo de 1 XML por vez (com prévia editável) quanto pela importação em lote (Bloco novo:
// sem tela de edição por arquivo — só os arquivos sem pendência são gravados; os demais
// aparecem no resultado do lote com o motivo, para revisão manual via o fluxo de 1 XML).
// =====================================================================================

async function parseAndAudit(db: any, context: any, xmlText: string, fileName: string | null): Promise<AuditResult> {
  const detected = detectAndParseFiscalXml(xmlText)
  const documentType = detected.documentType
  let parsed = detected.parsed
  const importHash = sha256(xmlText)
  const blockingErrors: string[] = [...parsed.errors]

  // 1. Duplicidade por chave de acesso — contra fiscal_documents já confirmados.
  let duplicateOfFiscalDocumentId: string | null = null
  if (parsed.accessKey) {
    const { data: existingDoc } = await db
      .from('fiscal_documents')
      .select('id')
      .eq('company_id', context.companyId)
      .eq('access_key', parsed.accessKey)
      .maybeSingle()
    if (existingDoc) {
      duplicateOfFiscalDocumentId = existingDoc.id
      blockingErrors.push(`Este documento já foi importado anteriormente (chave de acesso ${parsed.accessKey}).`)
    }
  }

  // 2. Determina a direção (entrada/saída) e bloqueia se o CNPJ da empresa ativa não
  //    corresponder nem ao emitente nem ao destinatário — Etapa 32D estende a 32B (que só
  //    aceitava entrada) para também aceitar NF-e de saída.
  const { data: company } = await db.from('companies').select('cnpj').eq('id', context.companyId).single()
  const companyCnpjNormalized = normalizeDocument(company?.cnpj)
  const emitDocNormalized = normalizeDocument(parsed.emitCnpj)
  const destDocNormalized = normalizeDocument(parsed.destCnpj || parsed.destCpf)

  const direction = resolveDirection(companyCnpjNormalized, emitDocNormalized, destDocNormalized)
  let companyCnpjMismatch = false
  if (!direction) {
    companyCnpjMismatch = true
    blockingErrors.push(`Nem o CNPJ do emitente (${parsed.emitCnpj || '—'}) nem o do destinatário (${parsed.destCnpj || parsed.destCpf || '—'}) correspondem ao CNPJ da empresa ativa. Confirme se este XML pertence a esta empresa antes de prosseguir.`)
  }

  if (documentType === 'NFE' && direction === 'IN') {
    const recovery = await resolvePisCofinsRecoverySettings(db, context.companyId)
    parsed = applyRecoverablePisCofinsForInboundNfe(parsed, recovery)
  }

  // 3. Resolução (só leitura) do parceiro — fornecedor (emitente) se Entrada, cliente
  //    (destinatário) se Saída.
  const partnerRole: 'SUPPLIER' | 'CUSTOMER' = direction === 'OUT' ? 'CUSTOMER' : 'SUPPLIER'
  const partnerDocNormalized = direction === 'OUT' ? destDocNormalized : emitDocNormalized
  const partnerName = direction === 'OUT'
    ? (parsed.destName || 'Cliente (nome não identificado no XML)')
    : (parsed.emitName || 'Fornecedor (nome não identificado no XML)')
  const accountColumn = partnerRole === 'CUSTOMER' ? 'customer_account_id' : 'supplier_account_id'

  let partner: FiscalXmlPreview['partner'] = {
    status: 'WILL_CREATE',
    partnerId: null,
    name: partnerName,
    documentNormalized: partnerDocNormalized,
    role: partnerRole,
    hasLinkedAccount: false
  }

  if (partnerDocNormalized) {
    const { data: existingPartner } = await db
      .from('partners')
      .select(`id, name, ${accountColumn}`)
      .eq('company_id', context.companyId)
      .eq('document_normalized', partnerDocNormalized)
      .maybeSingle()

    if (existingPartner) {
      partner = {
        status: 'FOUND',
        partnerId: existingPartner.id,
        name: existingPartner.name,
        documentNormalized: partnerDocNormalized,
        role: partnerRole,
        hasLinkedAccount: !!existingPartner[accountColumn]
      }
    }
  } else if (direction) {
    blockingErrors.push(
      direction === 'OUT'
        ? 'CNPJ/CPF do destinatário não encontrado no XML — não é possível resolver o cliente automaticamente.'
        : 'CNPJ/CPF do emitente não encontrado no XML — não é possível resolver o fornecedor automaticamente.'
    )
  }

  // 4. Registra a tentativa (mesmo que tenha erro/duplicidade) — trilha de auditoria
  // completa, igual ao padrão de bank_statement_imports (Etapa 18).
  const importStatus = duplicateOfFiscalDocumentId ? 'DUPLICATE' : parsed.errors.length > 0 ? 'ERROR' : 'PENDING_REVIEW'

  const { data: importRow, error: importError } = await db
    .from('fiscal_xml_imports')
    .insert({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      file_name: fileName || null,
      xml_raw: xmlText,
      access_key: parsed.accessKey,
      import_hash: importHash,
      import_status: importStatus,
      parse_errors: parsed.errors.length > 0 ? parsed.errors : null,
      parsed_preview: parsed
    })
    .select('id')
    .single()

  if (importError || !importRow) {
    throw importError || new Error('Falha ao registrar a tentativa de importação.')
  }

  return { xmlImportId: importRow.id, parsed, documentType, direction, partner, duplicateOfFiscalDocumentId, companyCnpjMismatch, blockingErrors }
}

async function writeFiscalDocumentFromImport(
  db: any,
  context: any,
  xmlImportId: string,
  header: HeaderInput,
  items: ItemInput[]
): Promise<{ ok: true; fiscalDocumentId: string; partnerId: string } | { ok: false; error: string; code: string }> {
  const { data: importRow, error: importFetchError } = await db
    .from('fiscal_xml_imports')
    .select('*')
    .eq('id', xmlImportId)
    .eq('company_id', context.companyId)
    .single()

  if (importFetchError || !importRow) {
    return { ok: false, error: 'Importação não encontrada ou pertence a outra empresa.', code: 'NOT_FOUND' }
  }
  if (importRow.import_status !== 'PENDING_REVIEW') {
    return { ok: false, error: `Esta importação já está com status ${importRow.import_status} e não pode ser confirmada novamente.`, code: 'INVALID_STATUS' }
  }

  // Defesa em profundidade: a DIREÇÃO (entrada/saída) é sempre re-derivada do snapshot
  // gravado no servidor no momento do parse (parsed_preview), nunca dos dados que o client
  // mandou de volta — o client não consegue "escolher" a direção nem forçar qual parceiro
  // é vinculado.
  const preview = importRow.parsed_preview as any
  const { data: company } = await db.from('companies').select('cnpj').eq('id', context.companyId).single()
  const companyCnpjNormalized = normalizeDocument(company?.cnpj)
  const previewEmitDocNormalized = normalizeDocument(preview?.emitCnpj)
  const previewDestDocNormalized = normalizeDocument(preview?.destCnpj || preview?.destCpf)
  const direction = resolveDirection(companyCnpjNormalized, previewEmitDocNormalized, previewDestDocNormalized)
  if (!direction) {
    return { ok: false, error: 'Nem o emitente nem o destinatário deste XML correspondem ao CNPJ da empresa ativa — importação bloqueada.', code: 'COMPANY_MISMATCH' }
  }

  // Reconfirma duplicidade por chave de acesso (corrida concorrente entre a prévia e a
  // confirmação) antes de gravar qualquer coisa.
  if (importRow.access_key) {
    const { data: existingDoc } = await db
      .from('fiscal_documents')
      .select('id')
      .eq('company_id', context.companyId)
      .eq('access_key', importRow.access_key)
      .maybeSingle()
    if (existingDoc) {
      await db.from('fiscal_xml_imports').update({ import_status: 'DUPLICATE', fiscal_document_id: existingDoc.id }).eq('id', xmlImportId)
      return { ok: false, error: 'Este documento já foi importado (chave de acesso duplicada) — confirmação bloqueada.', code: 'DUPLICATE_ACCESS_KEY' }
    }
  }

  // Resolve ou cria o parceiro — fornecedor (emitente) se Entrada, cliente (destinatário)
  // se Saída (Etapa 32D). Nunca duplica — busca por document_normalized antes de criar;
  // nunca remove o papel oposto (cliente/fornecedor) que o parceiro já tivesse.
  const isOutbound = direction === 'OUT'
  const partnerRole: 'customer' | 'supplier' = isOutbound ? 'customer' : 'supplier'
  const partnerDocument = isOutbound ? header.destCnpj || header.destCpf : header.emitCnpj
  const partnerName = isOutbound ? header.destName || 'Cliente' : header.emitName
  const partnerDocNormalized = normalizeDocument(partnerDocument)
  if (!partnerDocNormalized) {
    return {
      ok: false,
      error: isOutbound ? 'CNPJ/CPF do destinatário inválido — não é possível resolver o cliente.' : 'CNPJ/CPF do emitente inválido — não é possível resolver o fornecedor.',
      code: 'INVALID_EMIT_DOCUMENT'
    }
  }
  const roleFlagColumn = isOutbound ? 'is_customer' : 'is_supplier'
  const accountColumn = isOutbound ? 'customer_account_id' : 'supplier_account_id'

  let partnerId: string
  const { data: existingPartner } = await db
    .from('partners')
    .select(`id, is_supplier, is_customer, ${accountColumn}`)
    .eq('company_id', context.companyId)
    .eq('document_normalized', partnerDocNormalized)
    .maybeSingle()

  if (existingPartner) {
    partnerId = existingPartner.id
    const patch: Record<string, unknown> = {}
    if (!existingPartner[roleFlagColumn]) patch[roleFlagColumn] = true // nunca remove o papel oposto já marcado
    if (Object.keys(patch).length > 0) {
      await db.from('partners').update(patch).eq('id', partnerId).eq('company_id', context.companyId)
    }
    if (!existingPartner[accountColumn]) {
      const accResult = await createLinkedAccountForRole(db, context.companyId, context.workspaceId, partnerRole, partnerName)
      if (!('error' in accResult)) {
        await db.from('partners').update({ [accountColumn]: accResult.id }).eq('id', partnerId).eq('company_id', context.companyId)
      }
      // Falha ao criar a conta automática não bloqueia a importação do documento — o
      // parceiro já existe e pode ser usado normalmente; a conta pode ser criada depois
      // manualmente pela tela de Parceiros.
    }
  } else {
    const accResult = await createLinkedAccountForRole(db, context.companyId, context.workspaceId, partnerRole, partnerName)
    const linkedAccountId = 'error' in accResult ? null : accResult.id

    const { data: newPartner, error: partnerError } = await db
      .from('partners')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        name: partnerName,
        document: partnerDocument,
        document_type: partnerDocNormalized.length === 11 ? 'CPF' : 'CNPJ',
        is_supplier: !isOutbound,
        is_customer: isOutbound,
        is_carrier: false,
        is_employee: false,
        active: true,
        [accountColumn]: linkedAccountId
      })
      .select('id')
      .single()

    if (partnerError || !newPartner) {
      if (partnerError?.code === '23505') {
        return { ok: false, error: 'Corrida de importação: outro processo já cadastrou este parceiro. Tente confirmar novamente.', code: 'DUPLICATE_DOCUMENT' }
      }
      throw partnerError || new Error('Falha ao criar o parceiro automaticamente.')
    }
    partnerId = newPartner.id
  }

  // Etapa 32D: tipo de documento (NFE/CTE/NFSE) e tipo de operação são re-detectados a
  // partir do XML bruto guardado no servidor (xml_raw), nunca de um campo editável pelo
  // client.
  const documentType = detectDocumentType(importRow.xml_raw || '')
  const operationType =
    documentType === 'CTE'
      ? 'FREIGHT'
      : documentType === 'NFSE'
        ? (isOutbound ? 'SERVICE_PROVIDED' : 'SERVICE_TAKEN')
        : (isOutbound ? 'SALE' : 'PURCHASE')

  // Etapa 35A: pis_rate/cofins_rate do CABEÇALHO eram escritos com 1,65/7,60 fixos sempre
  // que havia valor de mercadoria em NF-e de entrada — mesmo hardcode do
  // applyRecoverablePisCofinsForInboundNfe, só que aqui na gravação do documento, e sem
  // checar se a configuração de recuperabilidade foi de fato aplicada. Agora deriva a
  // alíquota efetiva do próprio valor final (já configurado ou vindo do XML como está),
  // nunca escreve um percentual que não corresponde ao valor realmente gravado.
  const merchandiseBaseForRate = header.merchandiseAmount && header.merchandiseAmount > 0 ? header.merchandiseAmount : null
  const pisRateEffective = merchandiseBaseForRate && header.pisAmount != null
    ? Math.round((header.pisAmount / merchandiseBaseForRate) * 100 * 10000) / 10000
    : null
  const cofinsRateEffective = merchandiseBaseForRate && header.cofinsAmount != null
    ? Math.round((header.cofinsAmount / merchandiseBaseForRate) * 100 * 10000) / 10000
    : null

  // Etapa 35B.1-A: casa as Regras de Importação XML ANTES de gravar o documento, para poder
  // já usar a Natureza Fiscal resolvida no insert do cabeçalho (ver
  // docs/especificacao-fluxo-fiscal-operacional-35b1.md, Seções 3-4). Condições de
  // origin_state/destination_state/municipality_code/cest ainda não são alimentadas nesta
  // subetapa — o parser/HeaderInput/ItemInput ainda não propagam esses campos até aqui
  // (limitação documentada em docs/implementacao-35b1a-motor-fiscal-natureza-regras-
  // importacao.md); partner/CNPJ do emitente/CFOP do XML/NCM/produto do fornecedor/tipo de
  // documento/direção já funcionam normalmente.
  const importRules = await listActiveImportClassificationRulesForEngine(db, context.companyId)
  const previewItemsForMatching: any[] = Array.isArray(preview?.items) ? preview.items : []
  const supplierCodeByLine = new Map<number, string | null>()
  previewItemsForMatching.forEach((previewItem: any, idx: number) => {
    const line = previewItem?.lineNumber ?? idx + 1
    supplierCodeByLine.set(line, previewItem?.supplierProductCode || null)
  })

  const docMatchContext: MatchableDocumentContext = {
    partnerId,
    issuerCnpjNormalized: previewEmitDocNormalized,
    documentType,
    direction,
    originState: null,
    destinationState: null,
    municipalityCode: null
  }

  let natureIdFromRule: string | null = null
  const ruleApplicationsByLine = new Map<number, RuleApplicationResult>()

  if (importRules.length > 0) {
    items.forEach((item, idx) => {
      const lineNumber = item.lineNumber ?? idx + 1
      const itemMatchContext: MatchableItemContext = {
        xmlCfop: item.cfop || null,
        ncm: item.ncm || null,
        cest: null,
        itemId: null,
        supplierProductCode: supplierCodeByLine.get(lineNumber) || null,
        supplierDescription: item.description || null,
        amount: item.totalAmount || 0
      }
      const matchedRule = findMatchingImportRule(importRules, docMatchContext, itemMatchContext)
      if (matchedRule) {
        const application = buildRuleApplication(matchedRule)
        ruleApplicationsByLine.set(lineNumber, application)
        if (application.fiscalOperationNatureId && !natureIdFromRule) natureIdFromRule = application.fiscalOperationNatureId
      }
    })
  }

  // Grava o documento fiscal como IMPORTED (nunca BOOKED aqui — o fluxo de
  // validação/escrituração/contabilização continua manual, igual ao CRUD já existente).
  const { data: fiscalDoc, error: docError } = await db
    .from('fiscal_documents')
    .insert({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      partner_id: partnerId,
      fiscal_operation_nature_id: natureIdFromRule,
      direction,
      document_type: documentType,
      operation_type: operationType,
      number: header.documentNumber || null,
      series: header.series || null,
      access_key: header.accessKey || importRow.access_key || null,
      issue_date: header.issueDate,
      operation_date: header.operationDate,
      competence: competenceFirstDay(header.operationDate),
      document_amount: header.documentAmount,
      merchandise_amount: header.merchandiseAmount ?? null,
      freight_amount: header.freightAmount ?? null,
      insurance_amount: header.insuranceAmount ?? null,
      discount_amount: header.discountAmount ?? null,
      other_expenses_amount: header.otherExpensesAmount ?? null,
      icms_base: header.icmsBase ?? null,
      icms_amount: header.icmsAmount ?? null,
      iss_base: header.issBase ?? null,
      iss_amount: header.issAmount ?? null,
      pis_base: documentType === 'NFE' && direction === 'IN' ? merchandiseBaseForRate : null,
      pis_rate: documentType === 'NFE' && direction === 'IN' ? pisRateEffective : null,
      pis_amount: header.pisAmount ?? null,
      cofins_base: documentType === 'NFE' && direction === 'IN' ? merchandiseBaseForRate : null,
      cofins_rate: documentType === 'NFE' && direction === 'IN' ? cofinsRateEffective : null,
      cofins_amount: header.cofinsAmount ?? null,
      status: 'IMPORTED',
      accounting_status: 'NOT_ACCOUNTED',
      tax_status: 'NOT_ASSESSED',
      source: 'XML',
      import_hash: importRow.import_hash,
      notes: header.notes || null
    })
    .select('id')
    .single()

  if (docError || !fiscalDoc) {
    if (docError?.code === '23505') {
      return { ok: false, error: 'Este documento já foi importado (chave de acesso ou hash de importação duplicados).', code: 'DUPLICATE_ACCESS_KEY' }
    }
    throw docError || new Error('Falha ao gravar o documento fiscal.')
  }

  const itemRows = items.map((item, idx) => {
    const lineNumber = item.lineNumber ?? idx + 1
    const application = ruleApplicationsByLine.get(lineNumber) || null

    // Etapa 35B.1-A: xml_cfop preserva o CFOP de ORIGEM (auditoria, nunca mais editado);
    // "cfop" passa a ser o CFOP de ESCRITURAÇÃO — só é preenchido quando uma Regra de
    // Importação resolveu (application.bookkeepingCfop). Sem regra, fica em branco em vez de
    // copiar o CFOP do emitente (que é de uma direção diferente da escrituração própria —
    // ver docs/especificacao-fluxo-fiscal-operacional-35b1.md, Seção 1.4) e a pendência
    // BOOKKEEPING_CFOP_MISSING assume a partir daqui (validation-issues/rules.ts).
    const taxSituationPatch: { cst_icms?: string; csosn?: string } = {}
    if (application?.taxSituationCode) {
      taxSituationPatch[taxSituationTargetField(application.taxSituationCode)] = application.taxSituationCode
    }

    return {
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      fiscal_document_id: fiscalDoc.id,
      line_number: lineNumber,
      description: item.description,
      item_type: application?.itemKind || itemTypeForImportedDocument(documentType, item.itemType),
      quantity: item.quantity,
      unit: item.unit || null,
      unit_amount: item.unitPrice ?? null,
      total_amount: item.totalAmount,
      ncm: item.ncm || null,
      xml_cfop: item.cfop || null,
      cfop: application?.bookkeepingCfop || null,
      ...taxSituationPatch,
      icms_amount: item.icmsAmount ?? null,
      ipi_amount: item.ipiAmount ?? null,
      pis_amount: item.pisAmount ?? null,
      cofins_amount: item.cofinsAmount ?? null,
      iss_amount: item.issAmount ?? null
    }
  })

  const { data: insertedItems, error: itemsError } = await db.from('fiscal_document_items').insert(itemRows).select('id, line_number')
  if (itemsError) {
    await db.from('fiscal_documents').delete().eq('id', fiscalDoc.id).eq('company_id', context.companyId)
    throw itemsError
  }

  // Etapa 35A: matching conservador de item de XML -> catálogo interno. supplierProductCode
  // (cProd) vem sempre do snapshot server-side (importRow.parsed_preview), nunca do client —
  // mesma defesa em profundidade já usada para CNPJ/direção nesta importação. Só considera
  // "match forte" um mapeamento já existente por fornecedor+código; sem isso, cria uma
  // pendência de revisão em vez de adivinhar ou deixar o item silenciosamente sem vínculo.
  for (const inserted of insertedItems || []) {
    const supplierProductCode = supplierCodeByLine.get(inserted.line_number) || null
    const application = ruleApplicationsByLine.get(inserted.line_number) || null
    let matchedItemId: string | null = null

    if (supplierProductCode) {
      const { data: mapping, error: mappingError } = await db
        .from('partner_item_mappings')
        .select('item_id')
        .eq('company_id', context.companyId)
        .eq('partner_id', partnerId)
        .eq('supplier_product_code', supplierProductCode)
        .eq('active', true)
        .maybeSingle()
      if (mappingError) {
        await db.from('fiscal_documents').delete().eq('id', fiscalDoc.id).eq('company_id', context.companyId)
        throw mappingError
      }
      if (mapping?.item_id) {
        const { data: mappedItem, error: mappedItemError } = await db
          .from('items')
          .select('id')
          .eq('id', mapping.item_id)
          .eq('company_id', context.companyId)
          .maybeSingle()
        if (mappedItemError) {
          await db.from('fiscal_documents').delete().eq('id', fiscalDoc.id).eq('company_id', context.companyId)
          throw mappedItemError
        }
        if (mappedItem?.id) matchedItemId = mappedItem.id
      }
    }

    // Etapa 35B.1-A: sem mapeamento já confirmado, uma Regra de Importação com
    // create_partner_item_mapping=true + item alvo (rule.item_id) pode criar o vínculo agora
    // — desde que o item alvo realmente pertença à empresa ativa (mesma defesa em
    // profundidade do matching por mapeamento existente).
    if (!matchedItemId && application?.createPartnerItemMapping && application.targetItemId && supplierProductCode) {
      const { data: targetItem, error: targetItemError } = await db
        .from('items')
        .select('id')
        .eq('id', application.targetItemId)
        .eq('company_id', context.companyId)
        .maybeSingle()
      if (targetItemError) {
        await db.from('fiscal_documents').delete().eq('id', fiscalDoc.id).eq('company_id', context.companyId)
        throw targetItemError
      }
      if (targetItem?.id) {
        matchedItemId = targetItem.id
        const { data: existingMapping, error: existingMappingError } = await db
          .from('partner_item_mappings')
          .select('id')
          .eq('company_id', context.companyId)
          .eq('partner_id', partnerId)
          .eq('supplier_product_code', supplierProductCode)
          .maybeSingle()
        if (existingMappingError) {
          await db.from('fiscal_documents').delete().eq('id', fiscalDoc.id).eq('company_id', context.companyId)
          throw existingMappingError
        }
        const mappingError = existingMapping
          ? (await db.from('partner_item_mappings').update({ item_id: targetItem.id, active: true, source: 'XML' }).eq('id', existingMapping.id).eq('company_id', context.companyId)).error
          : (await db.from('partner_item_mappings').insert({
              workspace_id: context.workspaceId,
              company_id: context.companyId,
              partner_id: partnerId,
              item_id: targetItem.id,
              supplier_product_code: supplierProductCode,
              source: 'XML',
              active: true
            })).error
        if (mappingError) {
          await db.from('fiscal_documents').delete().eq('id', fiscalDoc.id).eq('company_id', context.companyId)
          throw mappingError
        }
      }
    }

    if (matchedItemId) {
      const { error: itemMatchError } = await db
        .from('fiscal_document_items')
        .update({ item_id: matchedItemId })
        .eq('id', inserted.id)
        .eq('company_id', context.companyId)
      if (itemMatchError) {
        await db.from('fiscal_documents').delete().eq('id', fiscalDoc.id).eq('company_id', context.companyId)
        throw itemMatchError
      }
    } else {
      const { error: issueInsertError } = await db.from('fiscal_document_item_review_issues').insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        fiscal_document_id: fiscalDoc.id,
        fiscal_document_item_id: inserted.id,
        issue_type: 'ITEM_WITHOUT_PRODUCT',
        severity: 'WARNING',
        details: { supplierProductCode, partnerId }
      })
      if (issueInsertError) {
        await db.from('fiscal_documents').delete().eq('id', fiscalDoc.id).eq('company_id', context.companyId)
        throw issueInsertError
      }
    }
  }

  const { error: importUpdateError } = await db
    .from('fiscal_xml_imports')
    .update({ import_status: 'CONFIRMED', fiscal_document_id: fiscalDoc.id })
    .eq('id', xmlImportId)
    .eq('company_id', context.companyId)
  if (importUpdateError) {
    await db.from('fiscal_documents').delete().eq('id', fiscalDoc.id).eq('company_id', context.companyId)
    throw importUpdateError
  }

  return { ok: true, fiscalDocumentId: fiscalDoc.id, partnerId }
}

// =====================================================================================
// PRÉVIA (1 arquivo) — parseia o XML, resolve (sem gravar) o fornecedor, checa duplicidade
// e divergência de CNPJ destinatário, registra a tentativa em fiscal_xml_imports (mesmo que
// nunca seja confirmada) e devolve tudo pronto para a tela de revisão editável.
// =====================================================================================

export async function previewFiscalXmlAction(rawInput: unknown): Promise<ActionResult<FiscalXmlPreview>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = previewFiscalXmlSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { xmlText, fileName } = validation.data

  try {
    const result = await parseAndAudit(db, context, xmlText, fileName || null)
    return {
      ok: true,
      data: {
        xmlImportId: result.xmlImportId,
        parsed: result.parsed,
        documentType: result.documentType,
        direction: result.direction,
        partner: result.partner,
        duplicateOfFiscalDocumentId: result.duplicateOfFiscalDocumentId,
        companyCnpjMismatch: result.companyCnpjMismatch,
        blockingErrors: result.blockingErrors
      },
      message: result.parsed.ok ? 'XML processado — revise os dados antes de confirmar.' : 'XML processado com pendências — revise antes de confirmar.'
    }
  } catch (error: any) {
    console.error('Erro ao pré-visualizar XML fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// CONFIRMAÇÃO (1 arquivo, com prévia editada pelo usuário) — resolve/cria o fornecedor
// (+ conta contábil automática), grava fiscal_documents/fiscal_document_items, e marca a
// importação como CONFIRMED. Nunca gera lançamento contábil (fora do escopo — ver Etapa 32C).
// =====================================================================================

export async function confirmFiscalXmlImportAction(rawInput: unknown): Promise<ActionResult<{ fiscalDocumentId: string; partnerId: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = confirmFiscalXmlImportSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { xmlImportId, items, ...header } = validation.data

  try {
    const result = await writeFiscalDocumentFromImport(db, context, xmlImportId, header, items)
    if (!result.ok) return result

    revalidateFiscal()
    return {
      ok: true,
      data: { fiscalDocumentId: result.fiscalDocumentId, partnerId: result.partnerId },
      message: 'Documento fiscal importado com sucesso a partir do XML! Revise em Documentos Fiscais antes de validar/escriturar.'
    }
  } catch (error: any) {
    console.error('Erro ao confirmar importação de XML fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// IMPORTAÇÃO EM LOTE — recebe vários XMLs de uma vez (seleção múltipla de arquivos).
// Cada arquivo é parseado e auditado individualmente; arquivos sem pendência bloqueante são
// confirmados automaticamente (sem tela de edição manual — é o próprio sentido de "em
// lote"); arquivos com pendência (CNPJ divergente, chave duplicada, campo obrigatório
// ausente, sem itens) NÃO são gravados — aparecem no resultado com o motivo, para revisão
// manual pelo fluxo de 1 XML (que já tem edição antes de confirmar). Um arquivo com erro
// nunca impede o processamento dos demais do lote.
// =====================================================================================

export async function bulkImportFiscalXmlAction(rawInput: unknown): Promise<ActionResult<BulkImportResultItem[]>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = bulkImportFiscalXmlSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const results: BulkImportResultItem[] = []

  for (const file of validation.data.files) {
    try {
      const audit = await parseAndAudit(db, context, file.xmlText, file.fileName)

      if (audit.blockingErrors.length > 0) {
        results.push({
          fileName: file.fileName,
          status: 'BLOCKED',
          reasons: audit.blockingErrors,
          supplierName: audit.parsed.emitName,
          documentAmount: audit.parsed.totalAmount
        })
        continue
      }
      if (audit.parsed.items.length === 0) {
        results.push({
          fileName: file.fileName,
          status: 'BLOCKED',
          reasons: ['Nenhum item (<det>) encontrado no XML — revise manualmente pelo fluxo de 1 arquivo.'],
          supplierName: audit.parsed.emitName,
          documentAmount: audit.parsed.totalAmount
        })
        continue
      }

      const header: HeaderInput = {
        accessKey: audit.parsed.accessKey || undefined,
        documentNumber: audit.parsed.documentNumber || undefined,
        series: audit.parsed.series || undefined,
        issueDate: audit.parsed.issueDate as string,
        operationDate: audit.parsed.operationDate || (audit.parsed.issueDate as string),
        emitCnpj: audit.parsed.emitCnpj as string,
        emitName: audit.parsed.emitName || '(sem nome no XML)',
        destCnpj: audit.parsed.destCnpj || undefined,
        destCpf: audit.parsed.destCpf || undefined,
        destName: audit.parsed.destName || undefined,
        documentAmount: audit.parsed.totalAmount as number,
        merchandiseAmount: audit.parsed.merchandiseAmount ?? undefined,
        freightAmount: audit.parsed.freightAmount ?? undefined,
        insuranceAmount: audit.parsed.insuranceAmount ?? undefined,
        discountAmount: audit.parsed.discountAmount ?? undefined,
        otherExpensesAmount: audit.parsed.otherExpensesAmount ?? undefined,
        icmsBase: audit.parsed.icmsBase ?? undefined,
        icmsAmount: audit.parsed.icmsAmount ?? undefined,
        pisAmount: audit.parsed.pisAmount ?? undefined,
        cofinsAmount: audit.parsed.cofinsAmount ?? undefined,
        ipiAmount: audit.parsed.ipiAmount ?? undefined,
        issBase: audit.parsed.issBase ?? undefined,
        issAmount: audit.parsed.issAmount ?? undefined,
        notes: audit.parsed.naturezaOperacao || undefined
      }
      const items: ItemInput[] = audit.parsed.items.map((it) => ({
        lineNumber: it.lineNumber,
        description: it.description,
        itemType: 'PRODUCT',
        quantity: it.quantity,
        unit: it.unit || undefined,
        unitPrice: it.unitPrice ?? undefined,
        totalAmount: it.totalAmount,
        ncm: it.ncm || undefined,
        cfop: it.cfop || undefined,
        icmsAmount: it.icmsAmount ?? undefined,
        ipiAmount: it.ipiAmount ?? undefined,
        pisAmount: it.pisAmount ?? undefined,
        cofinsAmount: it.cofinsAmount ?? undefined,
        issAmount: it.issAmount ?? undefined
      }))

      const writeResult = await writeFiscalDocumentFromImport(db, context, audit.xmlImportId, header, items)
      if (!writeResult.ok) {
        results.push({
          fileName: file.fileName,
          status: 'ERROR',
          reasons: [writeResult.error],
          supplierName: audit.parsed.emitName,
          documentAmount: audit.parsed.totalAmount
        })
      } else {
        results.push({
          fileName: file.fileName,
          status: 'IMPORTED',
          fiscalDocumentId: writeResult.fiscalDocumentId,
          supplierName: audit.parsed.emitName,
          documentAmount: audit.parsed.totalAmount
        })
      }
    } catch (error: any) {
      console.error('Erro ao importar XML em lote:', file.fileName, error)
      results.push({ fileName: file.fileName, status: 'ERROR', reasons: [error?.message || 'Falha de comunicação com o Supabase.'] })
    }
  }

  revalidateFiscal()

  const importedCount = results.filter((r) => r.status === 'IMPORTED').length
  return {
    ok: true,
    data: results,
    message: `${importedCount} de ${results.length} documento(s) importado(s) com sucesso.`
  }
}

export async function rejectFiscalXmlImportAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageFiscal())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = rejectFiscalXmlImportSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { xmlImportId, reason } = validation.data

  try {
    const { data, error } = await db
      .from('fiscal_xml_imports')
      .update({
        import_status: 'REJECTED',
        parse_errors: reason ? { rejectionReason: reason } : null
      })
      .eq('id', xmlImportId)
      .eq('company_id', context.companyId)
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao rejeitar a importação.')

    revalidateFiscal()
    return { ok: true, data: { id: data.id }, message: 'Importação de XML rejeitada — nenhum documento fiscal foi criado.' }
  } catch (error: any) {
    console.error('Erro ao rejeitar importação de XML fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
