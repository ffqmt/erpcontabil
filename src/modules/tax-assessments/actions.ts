'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageTaxAssessments, canCloseTaxAssessment, canPostFiscalToAccounting } from '@/lib/permissions/permissions'
import {
  createTaxAssessmentSchema,
  createBatchTaxAssessmentSchema,
  taxAssessmentIdSchema,
  adjustTaxAssessmentSchema,
  accountTaxAssessmentSchema,
  addTaxAssessmentManualLineSchema,
  updateTaxAssessmentManualLineSchema,
  deleteTaxAssessmentManualLineSchema,
  updateTaxAssessmentPreviousBalanceSchema,
  calculateIncomeTaxAssessmentSchema,
  addTaxAssessmentAdjustmentSchema,
  deleteTaxAssessmentAdjustmentSchema
} from './validations'
import { EDITABLE_ASSESSMENT_STATUSES } from './utils'
import { TaxType } from './types'
import { findEffectiveTaxRegimeRate } from './regime-rates/queries'
import { getDefaultEnabledTaxTypes, isAssessableTaxType, isDocumentAccountedTaxType } from './settings/options'
import { getDreRawData } from '@/modules/accounting/dre/queries'
import { calculateDre } from '@/modules/accounting/dre/dre-calculator'
import { listFiscalPendencies } from '@/modules/fiscal/validation-issues/queries'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function revalidateAssessments(id?: string) {
  revalidatePath('/fiscal/apuracoes')
  if (id) revalidatePath(`/fiscal/apuracoes/${id}`)
  // Etapa 35B: calcular/cancelar apuração pode mudar fiscal_documents.tax_status.
  revalidatePath('/fiscal/documentos')
  revalidatePath('/fiscal/pendencias')
}

// Campo de CABEÇALHO do documento fiscal que representa o tributo, por tax_type. IPI fica
// de fora deste mapa de propósito: fiscal_documents não tem coluna ipi_amount no
// cabeçalho (só existe em fiscal_document_items, adicionada na v1.4) — por isso IPI é
// tratado à parte, agregando por item (ver generateAutomaticLines). Tributos sem
// correspondência direta a um campo (SIMPLES/INSS_RETIDO/IRRF/PCC/OTHER) só entram na
// apuração via retenções (fiscal_document_retentions) ou linha manual.
const HEADER_TAX_FIELD: Partial<Record<TaxType, string>> = {
  ISS: 'iss_amount',
  ICMS: 'icms_amount'
}

// Etapa 24 (achado B1 da auditoria): ISS deliberadamente NÃO entra aqui — só ICMS/IPI
// geram crédito automático de documento de entrada. ISS tomado não vira crédito
// automático nesta rodada (regra explícita do pedido: "não considerar ISS como crédito
// automático, salvo regra explícita/manual" — quem precisar disso lança uma linha manual).
const CREDIT_ELIGIBLE_TAX_TYPES: TaxType[] = ['ICMS', 'IPI']

interface AutoLineDraft {
  fiscal_document_id: string
  source_type: 'FISCAL_DOCUMENT' | 'FISCAL_ITEM' | 'RETENTION'
  source_id: string
  line_type: 'DEBIT' | 'CREDIT' | 'RETENTION'
  description: string
  amount: number
  base_amount?: number | string | null
  tax_rate?: number | string | null
}

interface TaxAssessmentGeneratedLine {
  workspace_id: string
  company_id: string
  tax_assessment_id: string
  fiscal_document_id?: string
  source_type: 'FISCAL_DOCUMENT' | 'FISCAL_ITEM' | 'RETENTION'
  source_id?: string
  line_type: 'DEBIT' | 'CREDIT' | 'RETENTION'
  description: string
  base_amount?: number | string | null
  tax_rate?: number | string | null
  amount: number
}

interface SimplesCalculationBreakdown {
  fiscalOperationNatureId: string | null
  revenue: number
  taxRate: number
  amount: number
  taxRateId: string
}

export interface ExcludedAssessmentDocument {
  fiscalDocumentId: string
  documentNumber: string | null
  reason: string
}

/**
 * Etapa 35B.1-A: antes desta etapa, generateAutomaticLines somava TODO documento BOOKED da
 * competência sem checar nada sobre classificação — um documento com CFOP incompatível ou
 * sem Natureza Fiscal entrava exatamente igual a um documento correto (ver diagnóstico em
 * docs/especificacao-fluxo-fiscal-operacional-35b1.md, Seção 1.3). Esta função levanta, para
 * uma competência/tributo, quais documentos estão PRONTOS para apuração automática:
 * BOOKED, tax_status != IGNORED, com Natureza Fiscal definida, cuja Natureza não esteja
 * marcada enters_tax_assessment=false, e sem pendência CRITICAL aberta. Documentos que não
 * passam ficam fora da soma — e o motivo de cada exclusão é devolvido para a apuração
 * registrar (calculation_memory), em vez de excluir silenciosamente.
 */
async function getReadyDocumentsForAssessment(db: any, companyId: string, competence: string): Promise<{ readyIds: Set<string>; excluded: ExcludedAssessmentDocument[] }> {
  const { data: docs, error } = await db
    .from('fiscal_documents')
    .select('id, number, fiscal_operation_nature_id, fiscal_operation_nature:fiscal_operation_natures(enters_tax_assessment)')
    .eq('company_id', companyId)
    .eq('competence', competence)
    .eq('status', 'BOOKED')
    .neq('tax_status', 'IGNORED')
  if (error) throw error

  const candidates = (docs || []) as any[]
  const excluded: ExcludedAssessmentDocument[] = []
  const natureOkIds: string[] = []

  for (const d of candidates) {
    if (!d.fiscal_operation_nature_id) {
      excluded.push({ fiscalDocumentId: d.id, documentNumber: d.number, reason: 'Documento sem Natureza Fiscal definida.' })
      continue
    }
    if (d.fiscal_operation_nature?.enters_tax_assessment === false) {
      excluded.push({ fiscalDocumentId: d.id, documentNumber: d.number, reason: 'Natureza Fiscal configurada para não entrar na apuração.' })
      continue
    }
    natureOkIds.push(d.id)
  }

  if (natureOkIds.length === 0) return { readyIds: new Set(), excluded }

  const pendencies = await listFiscalPendencies(companyId, { competence })
  const criticalOpenIds = new Set(pendencies.filter((p) => p.status === 'OPEN' && p.severity === 'CRITICAL').map((p) => p.fiscalDocumentId))

  const readyIds = new Set<string>()
  for (const id of natureOkIds) {
    if (criticalOpenIds.has(id)) {
      const doc = candidates.find((d: any) => d.id === id)
      excluded.push({ fiscalDocumentId: id, documentNumber: doc?.number || null, reason: 'Documento com pendência crítica aberta.' })
    } else {
      readyIds.add(id)
    }
  }

  return { readyIds, excluded }
}

// Débitos: documentos de SAÍDA (venda/serviço prestado) — o tributo destacado é devido pela
// própria empresa. Créditos: documentos de ENTRADA (compra/serviço tomado) — o tributo
// destacado dá direito a crédito (só para os tipos em CREDIT_ELIGIBLE_TAX_TYPES). Em ambos
// os casos: só documentos BOOKED da competência exata (DRAFT/VALIDATED/CANCELLED nunca
// entram — ainda não escriturados ou fora da apuração por definição), e a partir da Etapa
// 35B.1-A, só documentos PRONTOS (ver getReadyDocumentsForAssessment) — readyIds já é esse
// filtro pré-calculado, então aqui só falta aplicá-lo.
async function generateAutomaticLines(
  db: any,
  companyId: string,
  competence: string,
  taxType: TaxType,
  readyIds: Set<string>
): Promise<{ debit: AutoLineDraft[]; credit: AutoLineDraft[]; retention: AutoLineDraft[] }> {
  const debit: AutoLineDraft[] = []
  const credit: AutoLineDraft[] = []
  const retention: AutoLineDraft[] = []
  if (readyIds.size === 0) return { debit, credit, retention }

  const readyIdsArray = Array.from(readyIds)
  const headerField = HEADER_TAX_FIELD[taxType]
  const creditEligible = CREDIT_ELIGIBLE_TAX_TYPES.includes(taxType)

  if (headerField) {
    const { data: outDocs } = await db
      .from('fiscal_documents')
      .select(`id, number, ${headerField}`)
      .eq('company_id', companyId)
      .eq('competence', competence)
      .eq('status', 'BOOKED')
      .eq('direction', 'OUT')
      .in('id', readyIdsArray)
      .gt(headerField, 0)
    ;(outDocs || []).forEach((d: any) => {
      const amt = Number(d[headerField])
      if (amt > 0) debit.push({ fiscal_document_id: d.id, source_type: 'FISCAL_DOCUMENT', source_id: d.id, line_type: 'DEBIT', description: `${taxType} — documento ${d.number || d.id}`, amount: amt })
    })

    if (creditEligible) {
      const { data: inDocs } = await db
        .from('fiscal_documents')
        .select(`id, number, ${headerField}`)
        .eq('company_id', companyId)
        .eq('competence', competence)
        .eq('status', 'BOOKED')
        .eq('direction', 'IN')
        .in('id', readyIdsArray)
        .gt(headerField, 0)
      ;(inDocs || []).forEach((d: any) => {
        const amt = Number(d[headerField])
        if (amt > 0) credit.push({ fiscal_document_id: d.id, source_type: 'FISCAL_DOCUMENT', source_id: d.id, line_type: 'CREDIT', description: `Crédito de ${taxType} — documento ${d.number || d.id}`, amount: amt })
      })
    }
  }

  if (taxType === 'IPI') {
    const { data: items } = await db
      .from('fiscal_document_items')
      .select('fiscal_document_id, ipi_amount, fiscal_documents!inner(id, number, direction, status, competence, company_id)')
      .eq('fiscal_documents.company_id', companyId)
      .eq('fiscal_documents.competence', competence)
      .eq('fiscal_documents.status', 'BOOKED')
      .in('fiscal_document_id', readyIdsArray)
      .not('ipi_amount', 'is', null)

    const byDocument = new Map<string, { documentNumber: string | null; direction: string; total: number }>()
    ;(items || []).forEach((it: any) => {
      const amt = Number(it.ipi_amount) || 0
      if (amt <= 0) return
      const doc = it.fiscal_documents
      const key = it.fiscal_document_id
      const entry = byDocument.get(key) || { documentNumber: doc?.number || null, direction: doc?.direction, total: 0 }
      entry.total += amt
      byDocument.set(key, entry)
    })

    byDocument.forEach((entry, fiscalDocumentId) => {
      if (entry.direction === 'OUT') {
        debit.push({ fiscal_document_id: fiscalDocumentId, source_type: 'FISCAL_DOCUMENT', source_id: fiscalDocumentId, line_type: 'DEBIT', description: `IPI — documento ${entry.documentNumber || fiscalDocumentId}`, amount: entry.total })
      } else if (entry.direction === 'IN') {
        credit.push({ fiscal_document_id: fiscalDocumentId, source_type: 'FISCAL_ITEM', source_id: fiscalDocumentId, line_type: 'CREDIT', description: `Crédito de IPI — documento ${entry.documentNumber || fiscalDocumentId}`, amount: entry.total })
      }
    })
  }

  // Retenções na fonte (IRRF, INSS_RETIDO, PCC, ISS, etc.) da tabela fiscal_document_retentions
  const { data: retentionsData } = await db
    .from('fiscal_document_retentions')
    .select('id, amount, base_amount, rate, fiscal_document_id, fiscal_documents!inner(id, number, direction, status, competence, company_id)')
    .eq('tax_type', taxType)
    .eq('fiscal_documents.company_id', companyId)
    .eq('fiscal_documents.competence', competence)
    .eq('fiscal_documents.status', 'BOOKED')
    .in('fiscal_document_id', readyIdsArray)
    .gt('amount', 0)

  ;(retentionsData || []).forEach((r: any) => {
    const amt = Number(r.amount) || 0
    if (amt <= 0) return
    const doc = r.fiscal_documents
    retention.push({
      fiscal_document_id: r.fiscal_document_id,
      source_type: 'RETENTION',
      source_id: r.id,
      line_type: 'RETENTION',
      description: `Retenção de ${taxType} — documento ${doc?.number || r.fiscal_document_id}`,
      base_amount: r.base_amount,
      tax_rate: r.rate,
      amount: amt
    })
  })

  return { debit, credit, retention }
}

// Soma as linhas atuais (automáticas recém-geradas + manuais preservadas) e os campos
// diretos (multa/juros/saldo anterior) e grava os totais + payable_amount/next_balance_amount
// na apuração. Fórmula corrigida na Etapa 24 (achado B1): saldo credor anterior agora É
// SUBTRAÍDO (reduz o valor a recolher), não somado — auditoria anterior não pegou isso
// porque nada preenchia previous_balance_amount na prática até esta etapa.
async function recomputeAssessmentTotals(db: any, assessmentId: string, companyId: string) {
  const { data: assessment } = await db.from('tax_assessments').select('fine_amount, interest_amount, previous_balance_amount').eq('id', assessmentId).eq('company_id', companyId).single()
  const { data: lines } = await db.from('tax_assessment_lines').select('line_type, amount').eq('tax_assessment_id', assessmentId).eq('company_id', companyId)

  let debitAmount = 0
  let creditAmount = 0
  let retainedAmount = 0
  let adjustmentPositive = 0
  let adjustmentNegative = 0

  ;(lines || []).forEach((l: any) => {
    const amt = Number(l.amount) || 0
    if (l.line_type === 'DEBIT') debitAmount += amt
    else if (l.line_type === 'CREDIT') creditAmount += amt
    else if (l.line_type === 'RETENTION') retainedAmount += amt
    else if (l.line_type === 'ADJUSTMENT_POSITIVE') adjustmentPositive += amt
    else if (l.line_type === 'ADJUSTMENT_NEGATIVE') adjustmentNegative += amt
  })

  const adjustmentAmount = adjustmentPositive - adjustmentNegative
  const fineAmount = Number(assessment?.fine_amount || 0)
  const interestAmount = Number(assessment?.interest_amount || 0)
  const previousBalanceAmount = Number(assessment?.previous_balance_amount || 0)

  const grossBalance = debitAmount - creditAmount - retainedAmount - previousBalanceAmount + adjustmentAmount + fineAmount + interestAmount
  const payableAmount = Math.max(0, grossBalance)
  const nextBalanceAmount = grossBalance < 0 ? Math.abs(grossBalance) : 0

  await db
    .from('tax_assessments')
    .update({
      debit_amount: debitAmount,
      credit_amount: creditAmount,
      retained_amount: retainedAmount,
      adjustment_amount: adjustmentAmount,
      payable_amount: payableAmount,
      next_balance_amount: nextBalanceAmount,
      amount_due: payableAmount,
      status: 'CALCULATED',
      calculation_memory: {
        debitAmount, creditAmount, retainedAmount, adjustmentAmount, adjustmentPositive, adjustmentNegative,
        fineAmount, interestAmount, previousBalanceAmount, grossBalance, payableAmount, nextBalanceAmount,
        calculatedAt: new Date().toISOString()
      }
    })
    .eq('id', assessmentId)
    .eq('company_id', companyId)

  return { debitAmount, creditAmount, retainedAmount, adjustmentAmount, payableAmount, nextBalanceAmount }
}

/**
 * Etapa 35B: sincroniza fiscal_documents.tax_status a partir do vinculo JA PERSISTIDO em
 * tax_assessment_lines (fiscal_document_id por linha) — nao foi criada uma tabela nova de
 * vinculo (tax_assessment_document_links) porque esta ja existe e ja e mantida a cada
 * calculo/recalculo (ver comentario no topo da migration v2.9). Um documento fica
 * 'ASSESSED' se tiver ao menos uma linha em uma apuracao cujo status != CANCELLED; caso
 * contrario volta para 'NOT_ASSESSED'. Documentos com tax_status='IGNORED' (documento
 * CANCELLED, ver fiscal/actions.ts) nunca sao tocados aqui — cancelamento de documento e uma
 * decisao mais forte que apuracao/desapuracao.
 */
async function syncFiscalDocumentTaxStatus(db: any, companyId: string, fiscalDocumentIds: string[]): Promise<void> {
  const ids = Array.from(new Set(fiscalDocumentIds.filter(Boolean)))
  if (ids.length === 0) return

  const { data: activeLinks, error: activeLinksError } = await db
    .from('tax_assessment_lines')
    .select('fiscal_document_id, tax_assessments!inner(status)')
    .in('fiscal_document_id', ids)
    .eq('company_id', companyId)
    .not('fiscal_document_id', 'is', null)
    .neq('tax_assessments.status', 'CANCELLED')
  if (activeLinksError) throw activeLinksError

  const stillAssessed = new Set((activeLinks || []).map((l: any) => l.fiscal_document_id))
  const toAssess = ids.filter((docId) => stillAssessed.has(docId))
  const toRevert = ids.filter((docId) => !stillAssessed.has(docId))

  if (toAssess.length > 0) {
    const { error } = await db.from('fiscal_documents').update({ tax_status: 'ASSESSED' }).eq('company_id', companyId).neq('status', 'CANCELLED').neq('tax_status', 'IGNORED').in('id', toAssess)
    if (error) throw error
  }
  if (toRevert.length > 0) {
    const { error } = await db.from('fiscal_documents').update({ tax_status: 'NOT_ASSESSED' }).eq('company_id', companyId).neq('status', 'CANCELLED').neq('tax_status', 'IGNORED').in('id', toRevert)
    if (error) throw error
  }
}

async function assertAssessmentEditable(db: any, assessmentId: string, companyId: string): Promise<{ error: string; code: string } | { assessment: any }> {
  const { data: assessment } = await db.from('tax_assessments').select('*').eq('id', assessmentId).eq('company_id', companyId).single()
  if (!assessment) return { error: 'Apuração fiscal não encontrada.', code: 'NOT_FOUND' }
  if (!EDITABLE_ASSESSMENT_STATUSES.includes(assessment.status)) {
    return { error: `Apuração ${assessment.status} não pode ser editada.`, code: 'INVALID_STATUS' }
  }
  // Defesa em profundidade (item explícito do pedido da Etapa 24): hoje obligation_id só é
  // gravado quando status=CLOSED (generateObligationFromAssessmentAction exige CLOSED desde
  // a Etapa 23), e CLOSED já cai no bloqueio acima — este guard é tecnicamente inalcançável
  // com as regras atuais, mas protege contra mudança futura de regra ou edição direta de
  // banco que deixe obligation_id preenchido numa apuração ainda "editável".
  if (assessment.obligation_id) {
    return { error: 'Esta apuração já possui obrigação gerada. Cancele ou revise a obrigação antes de recalcular.', code: 'HAS_OBLIGATION' }
  }
  return { assessment }
}

async function assertTaxTypeAllowedForAssessment(db: any, companyId: string, taxType: TaxType): Promise<{ error: string; code: string } | null> {
  if (isDocumentAccountedTaxType(taxType)) {
    return {
      error: `${taxType} não deve ser apurado nesta aba. Ele é contabilizado diretamente no lançamento do documento fiscal pelas regras contábeis.`,
      code: 'DOCUMENT_ACCOUNTED_TAX'
    }
  }

  if (!isAssessableTaxType(taxType)) {
    return { error: `Tributo ${taxType} não está disponível para apuração fiscal.`, code: 'INVALID_TAX_TYPE' }
  }

  const { data: setting, error } = await db
    .from('company_tax_assessment_settings')
    .select('enabled')
    .eq('company_id', companyId)
    .eq('tax_type', taxType)
    .maybeSingle()

  if (error) throw error
  if (setting) {
    if (!setting.enabled) {
      return { error: `${taxType} não está habilitado para apuração nesta empresa. Ajuste em Fiscal > Configurações Tributárias.`, code: 'TAX_TYPE_DISABLED' }
    }
    return null
  }

  const { data: company } = await db.from('companies').select('tax_regime').eq('id', companyId).single()
  if (!getDefaultEnabledTaxTypes(company?.tax_regime).includes(taxType)) {
    return { error: `${taxType} não está habilitado para o regime tributário atual da empresa.`, code: 'TAX_TYPE_DISABLED' }
  }

  return null
}

/**
 * Etapa 35A: calculation_mode existia em company_tax_assessment_settings mas nenhuma ação
 * de cálculo automático o lia (campo cosmético/enganoso). Bloqueia geração/recálculo
 * automático de linhas quando o tributo está configurado como MANUAL nesta empresa — o
 * usuário lança as linhas manualmente (addTaxAssessmentManualLineAction, que não depende
 * deste campo). Mesma regra de fallback de buildDefaultTaxAssessmentSettings quando não há
 * linha de configuração salva ainda.
 */
async function assertAutomaticCalculationAllowed(db: any, companyId: string, taxType: TaxType): Promise<{ error: string; code: string } | null> {
  const { data: setting, error } = await db
    .from('company_tax_assessment_settings')
    .select('calculation_mode')
    .eq('company_id', companyId)
    .eq('tax_type', taxType)
    .maybeSingle()

  if (error) throw error

  const calculationMode = setting?.calculation_mode || (['INSS_RETIDO', 'IRRF', 'PCC', 'OTHER'].includes(taxType) ? 'MANUAL' : 'AUTO')

  if (calculationMode === 'MANUAL') {
    return {
      error: `${taxType} está configurado como cálculo manual nesta empresa — nenhuma linha automática é gerada. Lance as linhas manualmente ou mude para automático em Fiscal > Configurações Tributárias.`,
      code: 'CALCULATION_MODE_MANUAL'
    }
  }

  return null
}

export async function createTaxAssessmentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createTaxAssessmentSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const competenceStart = `${validation.data.competence.substring(0, 7)}-01`

  try {
    const allowedCheck = await assertTaxTypeAllowedForAssessment(db, context.companyId, validation.data.taxType as TaxType)
    if (allowedCheck) return { ok: false, error: allowedCheck.error, code: allowedCheck.code }

    const { data: existing } = await db.from('tax_assessments').select('id').eq('company_id', context.companyId).eq('competence', competenceStart).eq('tax_type', validation.data.taxType).maybeSingle()
    if (existing) {
      return { ok: false, error: `Já existe uma apuração de ${validation.data.taxType} para esta competência.`, code: 'DUPLICATE_ASSESSMENT' }
    }

    const { data, error } = await db
      .from('tax_assessments')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        tax_type: validation.data.taxType,
        competence: competenceStart,
        due_date: validation.data.dueDate || null,
        status: 'DRAFT'
      })
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao criar apuração fiscal.')

    const calculationResult = validation.data.taxType === 'IRPJ' || validation.data.taxType === 'CSLL'
      ? await calculateIncomeTaxAssessmentAction({ id: data.id })
      : await calculateTaxAssessmentAction({ id: data.id })

    revalidateAssessments(data.id)
    if (!calculationResult.ok) {
      return {
        ok: true,
        data: { id: data.id },
        message: `Apuração criada, mas o cálculo automático não foi concluído: ${calculationResult.error}`
      }
    }

    return { ok: true, data: { id: data.id }, message: calculationResult.message || 'Apuração criada e calculada.' }
  } catch (error: any) {
    console.error('Erro ao criar apuração fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function calculateTaxAssessmentAction(rawInput: unknown): Promise<ActionResult<{ id: string; payableAmount: number }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = taxAssessmentIdSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id } = validation.data

  try {
    const { data: assessment } = await db.from('tax_assessments').select('*').eq('id', id).eq('company_id', context.companyId).single()
    if (!assessment) return { ok: false, error: 'Apuração fiscal não encontrada.', code: 'NOT_FOUND' }
    if (assessment.status !== 'DRAFT' && assessment.status !== 'CALCULATED') {
      return { ok: false, error: `Só é possível calcular apurações em Rascunho/Calculada (status atual: ${assessment.status}).`, code: 'INVALID_STATUS' }
    }
    if (assessment.obligation_id) {
      return { ok: false, error: 'Esta apuração já possui obrigação gerada. Cancele ou revise a obrigação antes de recalcular.', code: 'HAS_OBLIGATION' }
    }

    const taxType = assessment.tax_type as TaxType
    const allowedCheck = await assertTaxTypeAllowedForAssessment(db, context.companyId, taxType)
    if (allowedCheck) return { ok: false, error: allowedCheck.error, code: allowedCheck.code }

    const autoCheck = await assertAutomaticCalculationAllowed(db, context.companyId, taxType)
    if (autoCheck) return { ok: false, error: autoCheck.error, code: autoCheck.code }

    if (taxType === 'IRPJ' || taxType === 'CSLL') {
      return { ok: false, error: 'Use o cálculo específico de IRPJ/CSLL para esta apuração.', code: 'INVALID_TAX_TYPE' }
    }

    if (taxType === 'SIMPLES') {
      const { data: company } = await db.from('companies').select('tax_regime').eq('id', context.companyId).single()
      if (company?.tax_regime !== 'SIMPLES_NACIONAL') {
        return { ok: false, error: 'Simples Nacional só pode ser apurado para empresa nesse regime tributário.', code: 'INVALID_REGIME' }
      }

      await db.from('tax_assessment_lines').delete().eq('tax_assessment_id', id).eq('company_id', context.companyId).in('source_type', ['FISCAL_DOCUMENT', 'FISCAL_ITEM', 'RETENTION'])

      const { start, end } = monthRangeForCompetence(assessment.competence)
      const revenueByNature = await sumRevenueByNature(db, context.companyId, start, end)
      if (revenueByNature.length === 0) {
        return { ok: false, error: `Nenhum documento fiscal de saída Escriturado encontrado entre ${start} e ${end} — nada para apurar.`, code: 'NO_REVENUE' }
      }

      const newLines: TaxAssessmentGeneratedLine[] = []
      const breakdown: SimplesCalculationBreakdown[] = []
      for (const rev of revenueByNature) {
        const rate = await findEffectiveTaxRegimeRate(context.companyId, 'SIMPLES_NACIONAL', 'SIMPLES', end, rev.natureId)
        if (!rate) {
          return { ok: false, error: `Nenhuma alíquota do Simples Nacional configurada para ${rev.natureId ? 'esta natureza fiscal' : 'a empresa'}. Configure em Fiscal > Config. Tributárias.`, code: 'RATE_NOT_CONFIGURED' }
        }
        const amount = rev.amount * Number(rate.tax_rate)
        breakdown.push({ fiscalOperationNatureId: rev.natureId, revenue: rev.amount, taxRate: Number(rate.tax_rate), amount, taxRateId: rate.id })
        newLines.push({
          workspace_id: context.workspaceId,
          company_id: context.companyId,
          tax_assessment_id: id,
          source_type: 'FISCAL_DOCUMENT',
          line_type: 'DEBIT',
          description: `Simples Nacional devido — receita ${rev.amount.toFixed(2)} × ${(Number(rate.tax_rate) * 100).toFixed(2)}%`,
          base_amount: rev.amount,
          tax_rate: rate.tax_rate,
          amount
        })
      }

      if (newLines.length > 0) {
        const { error: linesError } = await db.from('tax_assessment_lines').insert(newLines)
        if (linesError) throw linesError
      }

      const totals = await recomputeAssessmentTotals(db, id, context.companyId)
      const { data: current } = await db.from('tax_assessments').select('calculation_memory').eq('id', id).eq('company_id', context.companyId).single()
      await db
        .from('tax_assessments')
        .update({ calculation_memory: { ...(current?.calculation_memory || {}), taxRegime: 'SIMPLES_NACIONAL', periodStart: start, periodEnd: end, revenueByNature: breakdown } })
        .eq('id', id)
        .eq('company_id', context.companyId)

      revalidateAssessments(id)
      return { ok: true, data: { id, payableAmount: totals.payableAmount }, message: `Apuração do Simples Nacional calculada — valor a recolher ${totals.payableAmount.toFixed(2)}.` }
    }

    // Etapa 35B: documentos hoje vinculados a esta apuração (antes de limpar/recalcular) —
    // usado depois do recalculo para saber quais documentos podem precisar voltar para
    // NOT_ASSESSED caso saiam do novo resultado (ver syncFiscalDocumentTaxStatus).
    const { data: previouslyLinked } = await db
      .from('tax_assessment_lines')
      .select('fiscal_document_id')
      .eq('tax_assessment_id', id)
      .eq('company_id', context.companyId)
      .not('fiscal_document_id', 'is', null)
    const previouslyLinkedIds = (previouslyLinked || []).map((r: any) => r.fiscal_document_id)

    // Limpa só as linhas geradas automaticamente na última execução — preserva 100% das
    // linhas manuais (source_type='MANUAL_ADJUSTMENT': créditos/débitos/retenções/ajustes
    // lançados à mão continuam intactos após recalcular).
    await db.from('tax_assessment_lines').delete().eq('tax_assessment_id', id).eq('company_id', context.companyId).in('source_type', ['FISCAL_DOCUMENT', 'FISCAL_ITEM', 'RETENTION'])

    // Etapa 35B.1-A: só documentos PRONTOS entram na soma automática — documentos excluídos
    // e o motivo vão para calculation_memory.excludedDocuments (ver getReadyDocumentsForAssessment).
    const readiness = await getReadyDocumentsForAssessment(db, context.companyId, assessment.competence)
    const { debit, credit, retention } = await generateAutomaticLines(db, context.companyId, assessment.competence, taxType, readiness.readyIds)

    const newLines: any[] = [...debit, ...credit, ...retention].map((l) => ({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      tax_assessment_id: id,
      fiscal_document_id: l.fiscal_document_id,
      source_type: l.source_type,
      source_id: l.source_id,
      line_type: l.line_type,
      description: l.description,
      base_amount: l.base_amount || null,
      tax_rate: l.tax_rate || null,
      amount: l.amount
    }))

    if (newLines.length > 0) {
      const { error: linesError } = await db.from('tax_assessment_lines').insert(newLines)
      if (linesError) throw linesError
    }

    const totals = await recomputeAssessmentTotals(db, id, context.companyId)

    const newlyLinkedIds = newLines.map((l) => l.fiscal_document_id).filter(Boolean)
    await syncFiscalDocumentTaxStatus(db, context.companyId, [...previouslyLinkedIds, ...newlyLinkedIds])

    // Etapa 35B.1-A: registra os documentos excluídos e o motivo — nunca exclusão silenciosa.
    // A UI de apuração ainda não tem uma seção dedicada para isso nesta subetapa (35B.1-B);
    // fica disponível em calculation_memory e no resumo da mensagem de retorno.
    const { data: currentForMemory } = await db.from('tax_assessments').select('calculation_memory').eq('id', id).eq('company_id', context.companyId).single()
    await db
      .from('tax_assessments')
      .update({ calculation_memory: { ...(currentForMemory?.calculation_memory || {}), excludedDocuments: readiness.excluded } })
      .eq('id', id)
      .eq('company_id', context.companyId)

    const excludedSuffix = readiness.excluded.length > 0 ? ` ${readiness.excluded.length} documento(s) ficaram fora da apuração (ver memória de cálculo para o motivo).` : ''

    revalidateAssessments(id)
    return { ok: true, data: { id, payableAmount: totals.payableAmount }, message: `Apuração calculada: ${newLines.length} linha(s) automática(s) geradas (débito/crédito/retenção), valor a recolher ${totals.payableAmount.toFixed(2)}.${excludedSuffix}` }
  } catch (error: any) {
    console.error('Erro ao calcular apuração fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function adjustTaxAssessmentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = adjustTaxAssessmentSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...fields } = validation.data

  try {
    const { data: assessment } = await db.from('tax_assessments').select('status').eq('id', id).eq('company_id', context.companyId).single()
    if (!assessment) return { ok: false, error: 'Apuração fiscal não encontrada.', code: 'NOT_FOUND' }
    if (assessment.status === 'CLOSED' || assessment.status === 'CANCELLED') {
      return { ok: false, error: `Apuração ${assessment.status} não pode receber ajustes.`, code: 'INVALID_STATUS' }
    }

    const update: Record<string, number> = {}
    if (fields.fineAmount !== undefined) update.fine_amount = fields.fineAmount
    if (fields.interestAmount !== undefined) update.interest_amount = fields.interestAmount

    if (Object.keys(update).length > 0) {
      const { error } = await db.from('tax_assessments').update(update).eq('id', id).eq('company_id', context.companyId)
      if (error) throw error
    }

    const totals = await recomputeAssessmentTotals(db, id, context.companyId)

    revalidateAssessments(id)
    return { ok: true, data: { id }, message: `Multa/juros salvos — valor a recolher recalculado: ${totals.payableAmount.toFixed(2)}.` }
  } catch (error: any) {
    console.error('Erro ao ajustar apuração fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// ETAPA 24: CRÉDITOS TRIBUTÁRIOS, SALDOS E AJUSTES (achado B1 da auditoria — ver
// docs/audit-fiscal-tax-assets.md e docs/tax-assessment-credits.md)
// =====================================================================================

export async function addTaxAssessmentManualLineAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = addTaxAssessmentManualLineSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { taxAssessmentId, lineType, description, amount, baseAmount, taxRate, notes } = validation.data

  try {
    const editable = await assertAssessmentEditable(db, taxAssessmentId, context.companyId)
    if ('error' in editable) return { ok: false, error: editable.error, code: editable.code }

    const { data, error } = await db
      .from('tax_assessment_lines')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        tax_assessment_id: taxAssessmentId,
        source_type: 'MANUAL_ADJUSTMENT',
        source_id: null,
        line_type: lineType,
        description,
        base_amount: baseAmount ?? null,
        tax_rate: taxRate ?? null,
        amount,
        notes: notes || null
      })
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao criar linha manual.')

    const totals = await recomputeAssessmentTotals(db, taxAssessmentId, context.companyId)

    revalidateAssessments(taxAssessmentId)
    return { ok: true, data: { id: data.id }, message: `Linha manual adicionada — valor a recolher recalculado: ${totals.payableAmount.toFixed(2)}.` }
  } catch (error: any) {
    console.error('Erro ao adicionar linha manual de apuração:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateTaxAssessmentManualLineAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateTaxAssessmentManualLineSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, taxAssessmentId, lineType, description, amount, baseAmount, taxRate, notes } = validation.data

  try {
    const editable = await assertAssessmentEditable(db, taxAssessmentId, context.companyId)
    if ('error' in editable) return { ok: false, error: editable.error, code: editable.code }

    const { data: line } = await db.from('tax_assessment_lines').select('id, source_type').eq('id', id).eq('company_id', context.companyId).eq('tax_assessment_id', taxAssessmentId).single()
    if (!line) return { ok: false, error: 'Linha não encontrada.', code: 'NOT_FOUND' }
    if (line.source_type !== 'MANUAL_ADJUSTMENT') {
      return { ok: false, error: 'Só é possível editar linhas lançadas manualmente — linhas geradas de documentos/retenções são recalculadas automaticamente.', code: 'NOT_MANUAL' }
    }

    const { error } = await db
      .from('tax_assessment_lines')
      .update({ line_type: lineType, description, base_amount: baseAmount ?? null, tax_rate: taxRate ?? null, amount, notes: notes || null })
      .eq('id', id)
      .eq('tax_assessment_id', taxAssessmentId)
      .eq('company_id', context.companyId)

    if (error) throw error

    const totals = await recomputeAssessmentTotals(db, taxAssessmentId, context.companyId)

    revalidateAssessments(taxAssessmentId)
    return { ok: true, data: { id }, message: `Linha manual atualizada — valor a recolher recalculado: ${totals.payableAmount.toFixed(2)}.` }
  } catch (error: any) {
    console.error('Erro ao atualizar linha manual de apuração:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function deleteTaxAssessmentManualLineAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = deleteTaxAssessmentManualLineSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, taxAssessmentId } = validation.data

  try {
    const editable = await assertAssessmentEditable(db, taxAssessmentId, context.companyId)
    if ('error' in editable) return { ok: false, error: editable.error, code: editable.code }

    const { data: line } = await db.from('tax_assessment_lines').select('id, source_type').eq('id', id).eq('company_id', context.companyId).eq('tax_assessment_id', taxAssessmentId).single()
    if (!line) return { ok: false, error: 'Linha não encontrada.', code: 'NOT_FOUND' }
    if (line.source_type !== 'MANUAL_ADJUSTMENT') {
      return { ok: false, error: 'Só é possível remover linhas lançadas manualmente.', code: 'NOT_MANUAL' }
    }

    const { error } = await db.from('tax_assessment_lines').delete().eq('id', id).eq('tax_assessment_id', taxAssessmentId).eq('company_id', context.companyId)
    if (error) throw error

    const totals = await recomputeAssessmentTotals(db, taxAssessmentId, context.companyId)

    revalidateAssessments(taxAssessmentId)
    return { ok: true, data: { id }, message: `Linha manual removida — valor a recolher recalculado: ${totals.payableAmount.toFixed(2)}.` }
  } catch (error: any) {
    console.error('Erro ao remover linha manual de apuração:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateTaxAssessmentPreviousBalanceAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = updateTaxAssessmentPreviousBalanceSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, previousBalanceAmount } = validation.data

  try {
    const editable = await assertAssessmentEditable(db, id, context.companyId)
    if ('error' in editable) return { ok: false, error: editable.error, code: editable.code }

    const { error } = await db.from('tax_assessments').update({ previous_balance_amount: previousBalanceAmount }).eq('id', id).eq('company_id', context.companyId)
    if (error) throw error

    const totals = await recomputeAssessmentTotals(db, id, context.companyId)

    revalidateAssessments(id)
    return { ok: true, data: { id }, message: `Saldo credor anterior salvo — valor a recolher recalculado: ${totals.payableAmount.toFixed(2)}.` }
  } catch (error: any) {
    console.error('Erro ao salvar saldo credor anterior:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function reviewTaxAssessmentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = taxAssessmentIdSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id } = validation.data

  try {
    const { data: assessment } = await db.from('tax_assessments').select('status').eq('id', id).eq('company_id', context.companyId).single()
    if (!assessment) return { ok: false, error: 'Apuração fiscal não encontrada.', code: 'NOT_FOUND' }
    if (assessment.status !== 'CALCULATED') {
      return { ok: false, error: `Só é possível revisar apurações Calculadas (status atual: ${assessment.status}).`, code: 'INVALID_STATUS' }
    }

    await db.from('tax_assessments').update({ status: 'REVIEWED', reviewed_at: new Date().toISOString() }).eq('id', id).eq('company_id', context.companyId)

    revalidateAssessments(id)
    return { ok: true, data: { id }, message: 'Apuração marcada como revisada.' }
  } catch (error: any) {
    console.error('Erro ao revisar apuração fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function closeTaxAssessmentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canCloseTaxAssessment())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para fechar apurações.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = taxAssessmentIdSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id } = validation.data

  try {
    const { data: assessment } = await db.from('tax_assessments').select('status').eq('id', id).eq('company_id', context.companyId).single()
    if (!assessment) return { ok: false, error: 'Apuração fiscal não encontrada.', code: 'NOT_FOUND' }
    if (assessment.status !== 'REVIEWED' && assessment.status !== 'CALCULATED') {
      return { ok: false, error: `Só é possível fechar apurações Calculadas/Revisadas (status atual: ${assessment.status}).`, code: 'INVALID_STATUS' }
    }

    // Garante que os totais gravados refletem exatamente as linhas/campos atuais antes de
    // fechar — cobre o caso de o usuário ter mexido em multa/juros/saldo anterior/linha
    // manual e o CALCULATED anterior estar tecnicamente desatualizado por qualquer motivo.
    await recomputeAssessmentTotals(db, id, context.companyId)

    await db.from('tax_assessments').update({ status: 'CLOSED', closed_at: new Date().toISOString() }).eq('id', id).eq('company_id', context.companyId)

    revalidateAssessments(id)
    return { ok: true, data: { id }, message: 'Apuração fechada. Gere a obrigação/guia ou contabilize o valor a recolher.' }
  } catch (error: any) {
    console.error('Erro ao fechar apuração fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function cancelTaxAssessmentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = taxAssessmentIdSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id } = validation.data

  try {
    const { data: assessment } = await db.from('tax_assessments').select('status, journal_entry_id').eq('id', id).eq('company_id', context.companyId).single()
    if (!assessment) return { ok: false, error: 'Apuração fiscal não encontrada.', code: 'NOT_FOUND' }
    if (assessment.journal_entry_id) {
      return { ok: false, error: 'Apuração já contabilizada — estorne o lançamento antes de cancelar.', code: 'ALREADY_ACCOUNTED' }
    }

    const { data: linked } = await db
      .from('tax_assessment_lines')
      .select('fiscal_document_id')
      .eq('tax_assessment_id', id)
      .eq('company_id', context.companyId)
      .not('fiscal_document_id', 'is', null)
    const linkedIds = (linked || []).map((r: any) => r.fiscal_document_id)

    await db.from('tax_assessments').update({ status: 'CANCELLED' }).eq('id', id).eq('company_id', context.companyId)

    // Etapa 35B: documento so continua ASSESSED se outra apuracao ativa ainda o referenciar.
    await syncFiscalDocumentTaxStatus(db, context.companyId, linkedIds)

    revalidateAssessments(id)
    return { ok: true, data: { id }, message: 'Apuração cancelada.' }
  } catch (error: any) {
    console.error('Erro ao cancelar apuração fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// ETAPA 21: APURAÇÃO -> CONTABILIDADE
// =====================================================================================

export async function accountTaxAssessmentAction(rawInput: unknown): Promise<ActionResult<{ journalEntryId: string; journalEntryNumber: number | null }>> {
  if (!(await canPostFiscalToAccounting())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para contabilizar tributos.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = accountTaxAssessmentSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, debitAccountId, creditAccountId } = validation.data

  try {
    const { data: assessment } = await db.from('tax_assessments').select('*').eq('id', id).eq('company_id', context.companyId).single()
    if (!assessment) return { ok: false, error: 'Apuração fiscal não encontrada.', code: 'NOT_FOUND' }
    if (assessment.status !== 'CLOSED') {
      return { ok: false, error: `Só é possível contabilizar apurações Fechadas (status atual: ${assessment.status}).`, code: 'INVALID_STATUS' }
    }
    if (assessment.journal_entry_id) {
      return { ok: false, error: 'Esta apuração já foi contabilizada.', code: 'ALREADY_ACCOUNTED' }
    }
    if (isDocumentAccountedTaxType(assessment.tax_type)) {
      return {
        ok: false,
        error: `${assessment.tax_type} já é contabilizado diretamente no lançamento do documento fiscal. Não contabilize novamente pela apuração.`,
        code: 'DOCUMENT_ACCOUNTED_TAX'
      }
    }
    const { data: assessmentSetting, error: settingError } = await db
      .from('company_tax_assessment_settings')
      .select('account_assessment')
      .eq('company_id', context.companyId)
      .eq('tax_type', assessment.tax_type)
      .maybeSingle()
    if (settingError) throw settingError
    if (assessmentSetting && !assessmentSetting.account_assessment) {
      return { ok: false, error: `${assessment.tax_type} está configurado para não gerar contabilização pela apuração.`, code: 'ACCOUNTING_DISABLED' }
    }
    const amount = Number(assessment.payable_amount || 0)
    if (amount <= 0) {
      return { ok: false, error: 'Apuração sem valor a recolher.', code: 'NOTHING_TO_ACCOUNT' }
    }
    if (debitAccountId === creditAccountId) {
      return { ok: false, error: 'A conta de débito não pode ser igual à conta de crédito.', code: 'INVALID_ACCOUNT' }
    }

    for (const accountId of [debitAccountId, creditAccountId]) {
      const { data: acc } = await db.from('chart_accounts').select('id, company_id, is_active, is_synthetic, accepts_entries').eq('id', accountId).single()
      if (!acc || acc.company_id !== context.companyId) return { ok: false, error: 'Uma das contas selecionadas não existe ou pertence a outra empresa.', code: 'INVALID_ACCOUNT' }
      if (!acc.is_active || acc.is_synthetic || !acc.accepts_entries) return { ok: false, error: 'As contas selecionadas devem ser analíticas, ativas e aceitar lançamentos.', code: 'INVALID_ACCOUNT' }
    }

    const { data: period } = await db.from('accounting_periods').select('status').eq('company_id', context.companyId).eq('competence', assessment.competence).single()
    if (!period) return { ok: false, error: `Período contábil para a competência ${assessment.competence} não encontrado.`, code: 'PERIOD_NOT_FOUND' }
    if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
      return { ok: false, error: `O período contábil (${assessment.competence}) está fechado (${period.status}).`, code: 'PERIOD_CLOSED' }
    }

    const lastDay = new Date(assessment.competence)
    lastDay.setMonth(lastDay.getMonth() + 1)
    lastDay.setDate(0)
    const entryDate = lastDay.toISOString().substring(0, 10)

    const { data: newEntry, error: insertError } = await db
      .from('journal_entries')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        entry_date: entryDate,
        competence: assessment.competence,
        description: `Provisão de ${assessment.tax_type} apurado — competência ${assessment.competence.substring(5, 7)}/${assessment.competence.substring(0, 4)}`,
        origin: 'FISCAL_ASSESSMENT',
        origin_id: id,
        status: 'DRAFT'
      })
      .select('id')
      .single()

    if (insertError || !newEntry) throw insertError || new Error('Falha ao criar cabeçalho do lançamento.')

    const journalEntryId = newEntry.id
    const { error: linesError } = await db.from('journal_entry_lines').insert([
      { workspace_id: context.workspaceId, company_id: context.companyId, journal_entry_id: journalEntryId, account_id: debitAccountId, debit_credit: 'DEBIT', amount, memo: `${assessment.tax_type} - ${assessment.competence}` },
      { workspace_id: context.workspaceId, company_id: context.companyId, journal_entry_id: journalEntryId, account_id: creditAccountId, debit_credit: 'CREDIT', amount, memo: `${assessment.tax_type} a recolher - ${assessment.competence}` }
    ])

    if (linesError) {
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      throw linesError
    }

    const { data: posted, error: postError } = await db.from('journal_entries').update({ status: 'POSTED' }).eq('id', journalEntryId).select('id, number').single()
    if (postError || !posted) {
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      return { ok: false, error: postError?.message || 'O banco rejeitou a publicação do lançamento.', code: 'UNBALANCED_ENTRY' }
    }

    await db.from('tax_assessments').update({ journal_entry_id: journalEntryId }).eq('id', id).eq('company_id', context.companyId)

    revalidateAssessments(id)
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')

    return { ok: true, data: { journalEntryId, journalEntryNumber: posted.number }, message: `Lançamento nº ${posted.number} gerado — provisão contabilizada!` }
  } catch (error: any) {
    console.error('Erro ao contabilizar apuração fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// ETAPA 34A — IRPJ/CSLL: motor de cálculo (Lucro Presumido / Lucro Real assistido) e
// ajustes manuais de Lucro Real. Reaproveita a mesma máquina de estado, calculation_memory
// e accountTaxAssessmentAction já usados por ICMS/IPI/ISS — só a GERAÇÃO das
// linhas automáticas é diferente (baseada em regime, não em campos de tributo do documento).
// =====================================================================================

function monthRangeForCompetence(competence: string): { start: string; end: string } {
  const [yearStr, monthStr] = competence.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function quarterRangeForCompetence(competence: string): { start: string; end: string; monthsInQuarter: number } {
  const [yearStr, monthStr] = competence.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const quarterIndex = Math.floor((month - 1) / 3) // 0..3
  const startMonth = quarterIndex * 3 + 1
  const endMonth = startMonth + 2
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`
  const lastDay = new Date(year, endMonth, 0).getDate()
  const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end, monthsInQuarter: 3 }
}

/**
 * Soma a receita bruta (documentos fiscais de saída, escriturados) do período, agrupada por
 * fiscal_operation_nature_id — fonte de dados recomendada no diagnóstico da Etapa 32A
 * (reaproveita o mesmo padrão de generateAutomaticLines, só trocando "linha de débito/
 * crédito" por "soma vira base de cálculo").
 */
async function sumRevenueByNature(db: any, companyId: string, start: string, end: string): Promise<{ natureId: string | null; amount: number }[]> {
  const { data } = await db
    .from('fiscal_documents')
    .select('document_amount, fiscal_operation_nature_id')
    .eq('company_id', companyId)
    .eq('direction', 'OUT')
    .eq('status', 'BOOKED')
    .gte('operation_date', start)
    .lte('operation_date', end)

  const totals = new Map<string | null, number>()
  ;(data || []).forEach((d: any) => {
    const key = d.fiscal_operation_nature_id || null
    totals.set(key, (totals.get(key) || 0) + Number(d.document_amount || 0))
  })
  return Array.from(totals.entries()).map(([natureId, amount]) => ({ natureId, amount }))
}

export async function calculateIncomeTaxAssessmentAction(rawInput: unknown): Promise<ActionResult<{ id: string; payableAmount: number }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = calculateIncomeTaxAssessmentSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id } = validation.data

  try {
    const editableCheck = await assertAssessmentEditable(db, id, context.companyId)
    if ('error' in editableCheck) return { ok: false, error: editableCheck.error, code: editableCheck.code }
    const assessment = editableCheck.assessment

    if (assessment.tax_type !== 'IRPJ' && assessment.tax_type !== 'CSLL') {
      return { ok: false, error: 'Esta ação de cálculo é específica de apurações IRPJ/CSLL.', code: 'INVALID_TAX_TYPE' }
    }

    const allowedCheck = await assertTaxTypeAllowedForAssessment(db, context.companyId, assessment.tax_type as TaxType)
    if (allowedCheck) return { ok: false, error: allowedCheck.error, code: allowedCheck.code }

    const autoCheck = await assertAutomaticCalculationAllowed(db, context.companyId, assessment.tax_type as TaxType)
    if (autoCheck) return { ok: false, error: autoCheck.error, code: autoCheck.code }

    const { data: company } = await db.from('companies').select('tax_regime').eq('id', context.companyId).single()
    const taxRegime = company?.tax_regime

    if (taxRegime === 'SIMPLES_NACIONAL') {
      return {
        ok: false,
        error: 'Empresa no Simples Nacional não apura IRPJ/CSLL separadamente — estão embutidos no DAS. Use uma apuração do tipo "Simples Nacional" em vez de IRPJ/CSLL.',
        code: 'SIMPLES_NOT_APPLICABLE'
      }
    }

    await db.from('tax_assessment_lines').delete().eq('tax_assessment_id', id).eq('company_id', context.companyId).in('source_type', ['FISCAL_DOCUMENT', 'FISCAL_ITEM'])

    const { start, end, monthsInQuarter } = quarterRangeForCompetence(assessment.competence)
    const newLines: any[] = []
    let memory: Record<string, unknown> = { taxRegime, periodStart: start, periodEnd: end }

    if (taxRegime === 'LUCRO_PRESUMIDO') {
      const revenueByNature = await sumRevenueByNature(db, context.companyId, start, end)
      if (revenueByNature.length === 0) {
        return { ok: false, error: `Nenhum documento fiscal de saída Escriturado encontrado entre ${start} e ${end} — nada para apurar.`, code: 'NO_REVENUE' }
      }

      let totalBase = 0
      const breakdown: any[] = []
      for (const rev of revenueByNature) {
        const rate = await findEffectiveTaxRegimeRate(context.companyId, 'LUCRO_PRESUMIDO', assessment.tax_type as 'IRPJ' | 'CSLL', end, rev.natureId)
        if (!rate || rate.presumption_rate === null || rate.presumption_rate === undefined) {
          return {
            ok: false,
            error: `Nenhum percentual de presunção de ${assessment.tax_type} configurado para ${rev.natureId ? 'esta natureza fiscal' : 'a empresa'} (Lucro Presumido). Configure em Fiscal > Config. Tributárias antes de calcular.`,
            code: 'RATE_NOT_CONFIGURED'
          }
        }
        const base = rev.amount * Number(rate.presumption_rate)
        totalBase += base
        breakdown.push({ fiscalOperationNatureId: rev.natureId, revenue: rev.amount, presumptionRate: Number(rate.presumption_rate), base, taxRateId: rate.id })
      }

      const rateForTax = breakdown[0]?.taxRateId ? await findEffectiveTaxRegimeRate(context.companyId, 'LUCRO_PRESUMIDO', assessment.tax_type as 'IRPJ' | 'CSLL', end, null) : null
      const effectiveRate = rateForTax || (await findEffectiveTaxRegimeRate(context.companyId, 'LUCRO_PRESUMIDO', assessment.tax_type as 'IRPJ' | 'CSLL', end, null))
      if (!effectiveRate) {
        return { ok: false, error: `Nenhuma alíquota de ${assessment.tax_type} configurada para Lucro Presumido. Configure em Fiscal > Config. Tributárias.`, code: 'RATE_NOT_CONFIGURED' }
      }

      const mainTax = totalBase * Number(effectiveRate.tax_rate)
      let additionalTax = 0
      if (assessment.tax_type === 'IRPJ' && effectiveRate.additional_rate && effectiveRate.additional_threshold_monthly) {
        const threshold = Number(effectiveRate.additional_threshold_monthly) * monthsInQuarter
        additionalTax = Math.max(0, totalBase - threshold) * Number(effectiveRate.additional_rate)
      }

      newLines.push({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        tax_assessment_id: id,
        source_type: 'FISCAL_DOCUMENT',
        line_type: 'DEBIT',
        description: `${assessment.tax_type} devido (Lucro Presumido) — base ${totalBase.toFixed(2)} × ${(Number(effectiveRate.tax_rate) * 100).toFixed(2)}%`,
        base_amount: totalBase,
        tax_rate: effectiveRate.tax_rate,
        amount: mainTax
      })
      if (additionalTax > 0) {
        newLines.push({
          workspace_id: context.workspaceId,
          company_id: context.companyId,
          tax_assessment_id: id,
          source_type: 'FISCAL_DOCUMENT',
          line_type: 'DEBIT',
          description: `Adicional de IRPJ (10% sobre o excedente do limite trimestral)`,
          base_amount: totalBase,
          tax_rate: effectiveRate.additional_rate,
          amount: additionalTax
        })
      }

      memory = { ...memory, revenueByNature: breakdown, totalBase, mainTax, additionalTax, taxRate: Number(effectiveRate.tax_rate) }
    } else if (taxRegime === 'LUCRO_REAL') {
      const dreData = await getDreRawData(context.companyId, start, end)
      const dreReport = calculateDre(dreData, assessment.competence)
      const netResult = dreReport.operatingProfit

      const { data: adjustments } = await db.from('tax_assessment_adjustments').select('*').eq('assessment_id', id).eq('company_id', context.companyId).eq('tax_type', assessment.tax_type)
      let additions = 0
      let exclusions = 0
      let compensations = 0
      ;(adjustments || []).forEach((a: any) => {
        const amt = Number(a.amount) || 0
        if (a.adjustment_type === 'ADDITION') additions += amt
        else if (a.adjustment_type === 'EXCLUSION') exclusions += amt
        else if (a.adjustment_type === 'COMPENSATION') compensations += amt
      })

      const base = Math.max(0, netResult + additions - exclusions - compensations)

      const effectiveRate = await findEffectiveTaxRegimeRate(context.companyId, 'LUCRO_REAL', assessment.tax_type as 'IRPJ' | 'CSLL', end, null)
      if (!effectiveRate) {
        return { ok: false, error: `Nenhuma alíquota de ${assessment.tax_type} configurada para Lucro Real. Configure em Fiscal > Config. Tributárias.`, code: 'RATE_NOT_CONFIGURED' }
      }

      const mainTax = base * Number(effectiveRate.tax_rate)
      let additionalTax = 0
      if (assessment.tax_type === 'IRPJ' && effectiveRate.additional_rate && effectiveRate.additional_threshold_monthly) {
        const threshold = Number(effectiveRate.additional_threshold_monthly) * monthsInQuarter
        additionalTax = Math.max(0, base - threshold) * Number(effectiveRate.additional_rate)
      }

      newLines.push({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        tax_assessment_id: id,
        source_type: 'FISCAL_DOCUMENT',
        line_type: 'DEBIT',
        description: `${assessment.tax_type} devido (Lucro Real) — resultado contábil ${netResult.toFixed(2)} + adições ${additions.toFixed(2)} − exclusões ${exclusions.toFixed(2)} − compensação ${compensations.toFixed(2)} = base ${base.toFixed(2)} × ${(Number(effectiveRate.tax_rate) * 100).toFixed(2)}%`,
        base_amount: base,
        tax_rate: effectiveRate.tax_rate,
        amount: mainTax
      })
      if (additionalTax > 0) {
        newLines.push({
          workspace_id: context.workspaceId,
          company_id: context.companyId,
          tax_assessment_id: id,
          source_type: 'FISCAL_DOCUMENT',
          line_type: 'DEBIT',
          description: 'Adicional de IRPJ (10% sobre o excedente do limite trimestral)',
          base_amount: base,
          tax_rate: effectiveRate.additional_rate,
          amount: additionalTax
        })
      }

      memory = { ...memory, netResult, additions, exclusions, compensations, base, mainTax, additionalTax, taxRate: Number(effectiveRate.tax_rate) }
    } else {
      return { ok: false, error: `Regime tributário da empresa (${taxRegime}) não reconhecido para apuração de IRPJ/CSLL.`, code: 'INVALID_REGIME' }
    }

    if (newLines.length > 0) {
      const { error: linesError } = await db.from('tax_assessment_lines').insert(newLines)
      if (linesError) throw linesError
    }

    const totals = await recomputeAssessmentTotals(db, id, context.companyId)

    // recomputeAssessmentTotals já gravou calculation_memory com os totais genéricos —
    // aqui fazemos um merge para preservar também a memória de cálculo detalhada (base de
    // presunção/resultado contábil/ajustes), sem perder os campos genéricos já gravados.
    const { data: current } = await db.from('tax_assessments').select('calculation_memory').eq('id', id).eq('company_id', context.companyId).single()
    await db.from('tax_assessments').update({ calculation_memory: { ...(current?.calculation_memory || {}), ...memory } }).eq('id', id).eq('company_id', context.companyId)

    revalidateAssessments(id)
    return { ok: true, data: { id, payableAmount: totals.payableAmount }, message: `Apuração de ${assessment.tax_type} calculada — valor a recolher ${totals.payableAmount.toFixed(2)}.` }
  } catch (error: any) {
    console.error('Erro ao calcular apuração de IRPJ/CSLL:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function addTaxAssessmentAdjustmentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = addTaxAssessmentAdjustmentSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }

  const context = await getCurrentContext()
  const db = await getDb()
  const { assessmentId, taxType, adjustmentType, description, amount } = validation.data

  try {
    const editableCheck = await assertAssessmentEditable(db, assessmentId, context.companyId)
    if ('error' in editableCheck) return { ok: false, error: editableCheck.error, code: editableCheck.code }

    const { data, error } = await db
      .from('tax_assessment_adjustments')
      .insert({ workspace_id: context.workspaceId, company_id: context.companyId, assessment_id: assessmentId, tax_type: taxType, adjustment_type: adjustmentType, description, amount, created_by: context.profileId })
      .select('id')
      .single()

    if (error || !data) throw error || new Error('Falha ao criar ajuste de apuração.')

    revalidateAssessments(assessmentId)
    return { ok: true, data: { id: data.id }, message: 'Ajuste adicionado — recalcule a apuração para aplicá-lo.' }
  } catch (error: any) {
    console.error('Erro ao criar ajuste de apuração fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function deleteTaxAssessmentAdjustmentAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageTaxAssessments())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = deleteTaxAssessmentAdjustmentSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, assessmentId } = validation.data

  try {
    const editableCheck = await assertAssessmentEditable(db, assessmentId, context.companyId)
    if ('error' in editableCheck) return { ok: false, error: editableCheck.error, code: editableCheck.code }

    const { error } = await db.from('tax_assessment_adjustments').delete().eq('id', id).eq('assessment_id', assessmentId).eq('company_id', context.companyId)
    if (error) throw error

    revalidateAssessments(assessmentId)
    return { ok: true, data: { id }, message: 'Ajuste removido — recalcule a apuração para aplicar.' }
  } catch (error: any) {
    console.error('Erro ao remover ajuste de apuração fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export interface BatchAssessmentResultItem {
  taxType: TaxType
  calculationMode: 'AUTO' | 'MANUAL'
  assessmentId?: string
  status?: string
  operation: 'created' | 'reused' | 'calculated' | 'manual_created' | 'closed_skipped' | 'cancelled_skipped' | 'error'
  payableAmount?: number
  message: string
}

export async function batchCreateTaxAssessmentsAction(rawInput: unknown): Promise<ActionResult<{ items: BatchAssessmentResultItem[] }>> {
  if (!(await canManageTaxAssessments())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = createBatchTaxAssessmentSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const competenceStart = `${validation.data.competence.substring(0, 7)}-01`

  try {
    const { data: rawSettings, error: settingsError } = await db
      .from('company_tax_assessment_settings')
      .select('id, company_id, tax_type, enabled, account_assessment, calculation_mode, notes')
      .eq('company_id', context.companyId)
      .eq('enabled', true)
      .order('tax_type', { ascending: true })

    if (settingsError) throw settingsError

    const activeSettings = (rawSettings || []) as {
      tax_type: TaxType
      enabled: boolean
      calculation_mode: 'AUTO' | 'MANUAL'
    }[]

    if (activeSettings.length === 0) {
      return {
        ok: false,
        error: 'Nenhum tributo está habilitado para apuração nesta empresa. Configure em Fiscal > Configurações Tributárias.',
        code: 'NO_ENABLED_TAX_TYPES'
      }
    }

    const items: BatchAssessmentResultItem[] = []

    for (const setting of activeSettings) {
      const taxType = setting.tax_type
      const calculationMode = setting.calculation_mode || (['INSS_RETIDO', 'IRRF', 'PCC', 'OTHER'].includes(taxType) ? 'MANUAL' : 'AUTO')
      const isRetentionType = ['IRRF', 'INSS_RETIDO', 'PCC'].includes(taxType)

      const allowedCheck = await assertTaxTypeAllowedForAssessment(db, context.companyId, taxType)
      if (allowedCheck) {
        items.push({
          taxType,
          calculationMode,
          operation: 'error',
          message: allowedCheck.error
        })
        continue
      }

      const { data: existing } = await db
        .from('tax_assessments')
        .select('id, status, payable_amount')
        .eq('company_id', context.companyId)
        .eq('competence', competenceStart)
        .eq('tax_type', taxType)
        .maybeSingle()

      if (existing) {
        if (existing.status === 'CLOSED') {
          items.push({
            taxType,
            calculationMode,
            assessmentId: existing.id,
            status: existing.status,
            operation: 'closed_skipped',
            payableAmount: Number(existing.payable_amount || 0),
            message: `Apuração de ${taxType} já encerrada em competência anterior — mantida sem alterações.`
          })
          continue
        }

        if (existing.status === 'CANCELLED') {
          items.push({
            taxType,
            calculationMode,
            assessmentId: existing.id,
            status: existing.status,
            operation: 'cancelled_skipped',
            payableAmount: 0,
            message: `Apuração de ${taxType} cancelada — mantida sem alterações.`
          })
          continue
        }

        if (calculationMode === 'AUTO' || isRetentionType) {
          const { readyIds } = await getReadyDocumentsForAssessment(db, context.companyId, competenceStart)
          const { debit, credit, retention } = await generateAutomaticLines(db, context.companyId, competenceStart, taxType, readyIds)

          await db
            .from('tax_assessment_lines')
            .delete()
            .eq('tax_assessment_id', existing.id)
            .eq('company_id', context.companyId)
            .in('source_type', ['FISCAL_DOCUMENT', 'FISCAL_ITEM', 'RETENTION'])

          const linesToInsert: any[] = [...debit, ...credit, ...retention].map((l) => ({
            workspace_id: context.workspaceId,
            company_id: context.companyId,
            tax_assessment_id: existing.id,
            fiscal_document_id: l.fiscal_document_id,
            source_type: l.source_type,
            source_id: l.source_id,
            line_type: l.line_type,
            description: l.description,
            base_amount: l.base_amount || null,
            tax_rate: l.tax_rate || null,
            amount: l.amount
          }))

          if (linesToInsert.length > 0) {
            await db.from('tax_assessment_lines').insert(linesToInsert)
          }

          const totals = await recomputeAssessmentTotals(db, existing.id, context.companyId)
          await syncFiscalDocumentTaxStatus(db, context.companyId, linesToInsert.map((l) => l.fiscal_document_id).filter(Boolean) as string[])

          items.push({
            taxType,
            calculationMode,
            assessmentId: existing.id,
            status: 'CALCULATED',
            operation: 'calculated',
            payableAmount: totals.payableAmount,
            message: `Apuração de ${taxType} recalculada — R$ ${totals.payableAmount.toFixed(2)}.`
          })
        } else {
          const totals = await recomputeAssessmentTotals(db, existing.id, context.companyId)
          items.push({
            taxType,
            calculationMode,
            assessmentId: existing.id,
            status: existing.status,
            operation: 'reused',
            payableAmount: totals.payableAmount,
            message: `Apuração de ${taxType} (Manual) mantida — R$ ${totals.payableAmount.toFixed(2)}.`
          })
        }
        continue
      }

      const { data: newAssessment, error: createError } = await db
        .from('tax_assessments')
        .insert({
          workspace_id: context.workspaceId,
          company_id: context.companyId,
          tax_type: taxType,
          competence: competenceStart,
          due_date: validation.data.dueDate || null,
          status: 'DRAFT'
        })
        .select('id')
        .single()

      if (createError || !newAssessment) {
        items.push({
          taxType,
          calculationMode,
          operation: 'error',
          message: `Falha ao criar registro de apuração para ${taxType}.`
        })
        continue
      }

      if (calculationMode === 'AUTO' || isRetentionType) {
        const { readyIds } = await getReadyDocumentsForAssessment(db, context.companyId, competenceStart)
        const { debit, credit, retention } = await generateAutomaticLines(db, context.companyId, competenceStart, taxType, readyIds)

        const linesToInsert: any[] = [...debit, ...credit, ...retention].map((l) => ({
          workspace_id: context.workspaceId,
          company_id: context.companyId,
          tax_assessment_id: newAssessment.id,
          fiscal_document_id: l.fiscal_document_id,
          source_type: l.source_type,
          source_id: l.source_id,
          line_type: l.line_type,
          description: l.description,
          base_amount: l.base_amount || null,
          tax_rate: l.tax_rate || null,
          amount: l.amount
        }))

        if (linesToInsert.length > 0) {
          await db.from('tax_assessment_lines').insert(linesToInsert)
        }

        const totals = await recomputeAssessmentTotals(db, newAssessment.id, context.companyId)
        await syncFiscalDocumentTaxStatus(db, context.companyId, linesToInsert.map((l) => l.fiscal_document_id).filter(Boolean) as string[])

        items.push({
          taxType,
          calculationMode,
          assessmentId: newAssessment.id,
          status: 'CALCULATED',
          operation: 'created',
          payableAmount: totals.payableAmount,
          message: `Apuração de ${taxType} criada e calculada — R$ ${totals.payableAmount.toFixed(2)}.`
        })
      } else {
        items.push({
          taxType,
          calculationMode,
          assessmentId: newAssessment.id,
          status: 'DRAFT',
          operation: 'manual_created',
          payableAmount: 0,
          message: `Apuração de ${taxType} (Manual) criada — aguarda lançamento de linhas.`
        })
      }
    }

    revalidateAssessments()
    return {
      ok: true,
      data: { items },
      message: `Processamento em lote da competência ${validation.data.competence.substring(0, 7)} concluído com sucesso.`
    }
  } catch (error: any) {
    console.error('Erro na apuração fiscal em lote por competência:', error)
    return { ok: false, error: error.message || 'Falha ao processar apurações em lote.', code: 'DATABASE_ERROR' }
  }
}

