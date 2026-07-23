import { getClient } from '@/lib/supabase/server'
import { FiscalAccountingApplication, FiscalAccountingApplicationLine, FiscalAccountingRule, FiscalAccountingRuleLine, FiscalAccountingSuggestion, AccountSource } from './types'
import { AccountingMemoSource, FiscalAmountSource, legacyLinesFromRule, normalizedRuleLines, renderAccountingMemo, roundCurrency, valueBaseAmount } from './utils'

async function getDb() {
  return getClient()
}

type DbClient = Awaited<ReturnType<typeof getClient>>

type FiscalDocumentItemForRule = {
  cfop: string | null
  item_type: string | null
}

type FiscalDocumentForRule = FiscalAmountSource & AccountingMemoSource & {
  id: string
  partner_id: string | null
  document_type: string | null
  direction: 'IN' | 'OUT' | string | null
  fiscal_operation_nature_id: string | null
  items?: FiscalDocumentItemForRule[]
}

type JournalEntryLineRow = FiscalAccountingApplicationLine & {
  journal_entry_id: string
}

type JournalEntryLineQueryRow = Omit<JournalEntryLineRow, 'account'> & {
  account?: { code: string; name: string } | { code: string; name: string }[] | null
}

async function attachRuleLines(db: DbClient, rules: FiscalAccountingRule[]): Promise<FiscalAccountingRule[]> {
  if (rules.length === 0) return rules

  const ruleIds = rules.map((rule) => rule.id)
  const { data, error } = await db
    .from('fiscal_accounting_rule_lines')
    .select('*, account:chart_accounts!fiscal_accounting_rule_lines_account_id_fkey(code, name)')
    .in('rule_id', ruleIds)
    .order('line_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message || 'Falha ao buscar partidas das regras contábeis fiscais.')

  const byRule = new Map<string, FiscalAccountingRuleLine[]>()
  for (const line of (data || []) as FiscalAccountingRuleLine[]) {
    if (!line.rule_id) continue
    const bucket = byRule.get(line.rule_id) || []
    bucket.push(line)
    byRule.set(line.rule_id, bucket)
  }

  return rules.map((rule) => ({
    ...rule,
    lines: byRule.get(rule.id) || legacyLinesFromRule(rule)
  }))
}

async function attachApplicationLines(db: DbClient, applications: FiscalAccountingApplication[]): Promise<FiscalAccountingApplication[]> {
  const entryIds = Array.from(new Set(applications.map((app) => app.journal_entry_id).filter(Boolean))) as string[]
  if (entryIds.length === 0) return applications

  const { data, error } = await db
    .from('journal_entry_lines')
    .select('id, journal_entry_id, debit_credit, account_id, amount, memo, cost_center_id, account:chart_accounts(code, name)')
    .in('journal_entry_id', entryIds)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message || 'Falha ao buscar as partidas geradas no lançamento contábil.')

  const byEntry = new Map<string, FiscalAccountingApplicationLine[]>()
  for (const rawLine of (data || []) as unknown as JournalEntryLineQueryRow[]) {
    const account = Array.isArray(rawLine.account) ? rawLine.account[0] || null : rawLine.account || null
    const line: JournalEntryLineRow = { ...rawLine, account }
    const bucket = byEntry.get(line.journal_entry_id) || []
    bucket.push(line)
    byEntry.set(line.journal_entry_id, bucket)
  }

  return applications.map((app) => ({
    ...app,
    lines: app.journal_entry_id ? byEntry.get(app.journal_entry_id) || [] : []
  }))
}

/**
 * Rastro completo (histórico, incluindo estornos) de como um documento fiscal foi
 * contabilizado — usado pela aba "Contabilidade" da tela do documento fiscal (Etapa 32C.6).
 */
export async function getFiscalAccountingApplications(fiscalDocumentId: string, companyId: string): Promise<FiscalAccountingApplication[]> {
  if (!fiscalDocumentId || !companyId) return []

  const db = await getDb()
  const { data, error } = await db
    .from('fiscal_accounting_applications')
    .select(`
      *,
      debit_account:chart_accounts!fiscal_accounting_applications_debit_account_id_fkey(code, name),
      credit_account:chart_accounts!fiscal_accounting_applications_credit_account_id_fkey(code, name),
      rule:fiscal_accounting_rules(name),
      journal_entry:journal_entries!fiscal_accounting_applications_journal_entry_id_fkey(number, status),
      reversal_journal_entry:journal_entries!fiscal_accounting_applications_reversal_journal_entry_id_fkey(number, status)
    `)
    .eq('fiscal_document_id', fiscalDocumentId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message || 'Falha ao buscar o rastro de contabilização do documento fiscal.')
  return attachApplicationLines(db, (data || []) as unknown as FiscalAccountingApplication[])
}

export async function listFiscalAccountingRules(companyId: string): Promise<FiscalAccountingRule[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida para a consulta de regras contábeis fiscais.')

  const db = await getDb()
  const { data, error } = await db
    .from('fiscal_accounting_rules')
    .select('*, debit_account:chart_accounts!fiscal_accounting_rules_debit_account_id_fkey(code, name), credit_account:chart_accounts!fiscal_accounting_rules_credit_account_id_fkey(code, name), fiscal_operation_nature:fiscal_operation_natures(code, name), partner:partners(name)')
    .eq('company_id', companyId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message || 'Falha ao buscar regras contábeis fiscais.')
  return attachRuleLines(db, (data || []) as unknown as FiscalAccountingRule[])
}

export async function getFiscalAccountingRuleById(id: string, companyId: string): Promise<FiscalAccountingRule | null> {
  if (!id || !companyId) throw new Error('ID de regra e empresa ativa são obrigatórios.')

  const db = await getDb()
  const { data, error } = await db
    .from('fiscal_accounting_rules')
    .select('*, debit_account:chart_accounts!fiscal_accounting_rules_debit_account_id_fkey(code, name), credit_account:chart_accounts!fiscal_accounting_rules_credit_account_id_fkey(code, name), fiscal_operation_nature:fiscal_operation_natures(code, name), partner:partners(name)')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Falha ao buscar a regra contábil fiscal.')
  if (!data) return null
  const [rule] = await attachRuleLines(db, [data as FiscalAccountingRule])
  return rule
}

function cfopMatchesPattern(cfop: string | null, pattern: string | null): boolean {
  if (!pattern) return true
  if (!cfop) return false
  // Padrão simples de prefixo (ex.: "56" casa 5656, 5652...) — mesmo espírito simples e
  // sem regex do motor de conciliação bancária da Etapa 30A.
  return cfop.startsWith(pattern)
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
}

function conditionValues(values: string[] | null | undefined, legacyValue: string | null | undefined): string[] {
  if (values?.length) return uniqueValues(values)
  return uniqueValues([legacyValue])
}

function matchesOneOf(allowedValues: string[], actualValue: string | null | undefined): boolean {
  if (allowedValues.length === 0) return true
  if (!actualValue) return false
  return allowedValues.includes(actualValue)
}

function intersects(allowedValues: string[], actualValues: string[]): boolean {
  if (allowedValues.length === 0) return true
  return actualValues.some((actualValue) => allowedValues.includes(actualValue))
}

/**
 * Conta a quantidade de condições preenchidas (não-nulas) de uma regra — usado como medida
 * de especificidade: regra com mais condições preenchidas que casaram é mais específica e
 * vence contra uma regra mais genérica, mesmo que ambas tenham a mesma prioridade.
 */
function specificityScore(rule: FiscalAccountingRule): number {
  let score = 0
  if (conditionValues(rule.document_types, rule.document_type).length) score++
  if (conditionValues(rule.directions, rule.direction).length) score++
  if (conditionValues(rule.cfops, rule.cfop).length) score++
  if (conditionValues(rule.cfop_patterns, rule.cfop_pattern).length) score++
  if (conditionValues(rule.fiscal_operation_nature_ids, rule.fiscal_operation_nature_id).length) score++
  if (conditionValues(rule.item_types, rule.item_type).length) score++
  if (conditionValues(rule.partner_ids, rule.partner_id).length) score++
  if (conditionValues(rule.tax_regimes, rule.tax_regime).length) score++
  if (rule.min_amount !== null && rule.min_amount !== undefined) score++
  if (rule.max_amount !== null && rule.max_amount !== undefined) score++
  return score
}

function ruleMatchesDocument(rule: FiscalAccountingRule, doc: FiscalDocumentForRule, itemTypes: string[], taxRegime: string | null): boolean {
  if (!rule.active) return false
  const docCfops = uniqueValues((doc.items || []).map((it) => it.cfop))

  if (!matchesOneOf(conditionValues(rule.document_types, rule.document_type), doc.document_type)) return false
  if (!matchesOneOf(conditionValues(rule.directions, rule.direction), doc.direction)) return false
  if (!intersects(conditionValues(rule.cfops, rule.cfop), docCfops)) return false

  const cfopPatterns = conditionValues(rule.cfop_patterns, rule.cfop_pattern)
  if (cfopPatterns.length > 0 && !docCfops.some((cfop) => cfopPatterns.some((pattern) => cfopMatchesPattern(cfop, pattern)))) return false

  if (!matchesOneOf(conditionValues(rule.fiscal_operation_nature_ids, rule.fiscal_operation_nature_id), doc.fiscal_operation_nature_id)) return false
  if (!intersects(conditionValues(rule.item_types, rule.item_type), itemTypes)) return false
  if (!matchesOneOf(conditionValues(rule.partner_ids, rule.partner_id), doc.partner_id)) return false
  if (!matchesOneOf(conditionValues(rule.tax_regimes, rule.tax_regime), taxRegime)) return false

  const amount = Number(doc.document_amount ?? 0)
  if (rule.min_amount !== null && rule.min_amount !== undefined && amount < Number(rule.min_amount)) return false
  if (rule.max_amount !== null && rule.max_amount !== undefined && amount > Number(rule.max_amount)) return false

  return true
}

interface ResolvedAccount {
  accountId: string | null
  accountLabel: string
  warning: string | null
}

/**
 * Resolve a conta de um dos lados da regra (débito ou crédito) — fixa (usa direto) ou
 * dinâmica de parceiro (cliente/fornecedor do próprio documento). Nunca cria nada aqui —
 * essa função é usada tanto pela prévia (só leitura) quanto, depois, pela contabilização de
 * fato (que aí sim pode criar a conta do parceiro se faltar, reaproveitando
 * createLinkedAccountForRole, exatamente como o servidor faz ao confirmar).
 */
async function resolveAccountSource(
  db: DbClient,
  source: AccountSource,
  fixedAccountId: string | null,
  partnerId: string | null
): Promise<ResolvedAccount> {
  if (source === 'FIXED') {
    if (!fixedAccountId) return { accountId: null, accountLabel: '(conta fixa não configurada)', warning: 'Regra sem conta fixa configurada.' }
    const { data: acc } = await db.from('chart_accounts').select('id, code, name, is_active, is_synthetic, accepts_entries').eq('id', fixedAccountId).maybeSingle()
    if (!acc) return { accountId: null, accountLabel: '(conta não encontrada)', warning: 'A conta fixa configurada na regra não foi encontrada.' }
    if (!acc.is_active || acc.is_synthetic || !acc.accepts_entries) {
      return { accountId: acc.id, accountLabel: `${acc.code} — ${acc.name}`, warning: 'A conta fixa configurada na regra não está mais ativa/analítica — ajuste a regra.' }
    }
    return { accountId: acc.id, accountLabel: `${acc.code} — ${acc.name}`, warning: null }
  }

  // PARTNER_CUSTOMER / PARTNER_SUPPLIER
  if (!partnerId) {
    return { accountId: null, accountLabel: '(sem parceiro no documento)', warning: 'Documento sem parceiro vinculado — não é possível resolver a conta dinâmica.' }
  }
  const { data: partner } = await db
    .from('partners')
    .select('id, name, customer_account_id, supplier_account_id')
    .eq('id', partnerId)
    .maybeSingle()
  if (!partner) return { accountId: null, accountLabel: '(parceiro não encontrado)', warning: 'Parceiro do documento não encontrado.' }

  const linkedAccountId = source === 'PARTNER_CUSTOMER' ? partner.customer_account_id : partner.supplier_account_id
  if (!linkedAccountId) {
    const roleLabel = source === 'PARTNER_CUSTOMER' ? 'cliente' : 'fornecedor'
    return { accountId: null, accountLabel: `${partner.name} (sem conta de ${roleLabel} ainda)`, warning: `${partner.name} ainda não tem conta contábil de ${roleLabel} — será criada automaticamente ao contabilizar.` }
  }
  const { data: acc } = await db.from('chart_accounts').select('id, code, name').eq('id', linkedAccountId).maybeSingle()
  if (!acc) return { accountId: null, accountLabel: `${partner.name} (conta vinculada não encontrada)`, warning: 'A conta vinculada ao parceiro não foi encontrada — será recriada ao contabilizar.' }
  return { accountId: acc.id, accountLabel: `${acc.code} — ${acc.name}`, warning: null }
}

/**
 * Motor de sugestão de contabilização (Etapa 32C.4). Carrega o documento fiscal, itens,
 * parceiro e a empresa (para o regime tributário), busca a melhor regra ativa que casa, e
 * resolve as contas (fixas ou dinâmicas de parceiro) — sem gravar nada. Retorna null se
 * nenhuma regra casar (fluxo manual continua disponível normalmente).
 */
export async function findFiscalAccountingRuleForDocument(fiscalDocumentId: string, companyId: string): Promise<FiscalAccountingSuggestion | null> {
  const db = await getDb()

  const { data: doc } = await db
    .from('fiscal_documents')
    .select('*, partner:partners(name), items:fiscal_document_items(cfop, item_type)')
    .eq('id', fiscalDocumentId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!doc) return null

  const { data: company } = await db.from('companies').select('tax_regime').eq('id', companyId).maybeSingle()
  const taxRegime = company?.tax_regime || null

  const { data: rules } = await db
    .from('fiscal_accounting_rules')
    .select('*, debit_account:chart_accounts!fiscal_accounting_rules_debit_account_id_fkey(code, name), credit_account:chart_accounts!fiscal_accounting_rules_credit_account_id_fkey(code, name)')
    .eq('company_id', companyId)
    .eq('active', true)

  if (!rules || rules.length === 0) return null

  const fiscalDoc = doc as FiscalDocumentForRule
  const itemTypes: string[] = Array.from(new Set((fiscalDoc.items || []).map((it) => it.item_type).filter((itemType): itemType is string => Boolean(itemType))))

  const rulesWithLines = await attachRuleLines(db, rules as FiscalAccountingRule[])
  const matching = rulesWithLines.filter((r) => ruleMatchesDocument(r, fiscalDoc, itemTypes, taxRegime))
  if (matching.length === 0) return null

  matching.sort((a, b) => {
    const specDiff = specificityScore(b) - specificityScore(a)
    if (specDiff !== 0) return specDiff
    const prioDiff = a.priority - b.priority
    if (prioDiff !== 0) return prioDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const rule = matching[0]
  const warnings: string[] = []
  const ruleLines = normalizedRuleLines(rule)
  const fallbackDescription = `Documento fiscal ${fiscalDoc.number || fiscalDoc.id} — contabilizado pela regra "${rule.name}"`
  const description = renderAccountingMemo(rule.description_template, fiscalDoc, fallbackDescription)
  const lines: FiscalAccountingSuggestion['lines'] = []

  for (const line of ruleLines) {
    const account = await resolveAccountSource(db, line.account_source, line.account_id, fiscalDoc.partner_id)
    if (account.warning) warnings.push(account.warning)

    const amount = roundCurrency(valueBaseAmount(fiscalDoc, line.value_base) * Number(line.amount_multiplier ?? 1))
    if (!(amount > 0)) {
      warnings.push(`Partida ${line.line_order} ignorada na contabilização porque a base ${line.value_base} resultou em valor zero.`)
      continue
    }

    lines.push({
      debitCredit: line.debit_credit,
      accountId: account.accountId || '',
      accountName: account.accountLabel,
      amount,
      valueBase: line.value_base,
      amountMultiplier: Number(line.amount_multiplier ?? 1),
      memo: renderAccountingMemo(line.memo_template || rule.description_template, fiscalDoc, description)
    })
  }

  const debitTotal = roundCurrency(lines.filter((line) => line.debitCredit === 'DEBIT').reduce((sum, line) => sum + line.amount, 0))
  const creditTotal = roundCurrency(lines.filter((line) => line.debitCredit === 'CREDIT').reduce((sum, line) => sum + line.amount, 0))
  const debit = lines.find((line) => line.debitCredit === 'DEBIT')
  const credit = lines.find((line) => line.debitCredit === 'CREDIT')

  if (lines.length === 0) {
    warnings.push('A regra casou, mas nenhuma partida ficou com valor maior que zero para este documento.')
  }
  if (Math.abs(debitTotal - creditTotal) > 0.009) {
    warnings.push(`A regra está desbalanceada para este documento: débitos ${debitTotal.toFixed(2)} e créditos ${creditTotal.toFixed(2)}.`)
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    debitAccountId: debit?.accountId || '',
    debitAccountName: debit?.accountName || '(sem partida de débito válida)',
    creditAccountId: credit?.accountId || '',
    creditAccountName: credit?.accountName || '(sem partida de crédito válida)',
    amount: debitTotal,
    description,
    explanation: `Regra "${rule.name}" (prioridade ${rule.priority}) casou com este documento e gerará ${lines.length} partida(s).`,
    warnings,
    lines,
    debitTotal,
    creditTotal
  }
}

export { resolveAccountSource }
