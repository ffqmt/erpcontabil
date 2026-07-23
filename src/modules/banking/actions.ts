'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canImportBankStatements, canReconcileBankStatements } from '@/lib/permissions/permissions'
import { parseBankStatementCsv } from './csv-parser'
import { computeLineHash, bankLineBaseKey } from './utils'
import {
  importBankStatementCsvSchema,
  classifyBankStatementLineSchema,
  generateJournalEntryFromBankLineSchema,
  ignoreBankStatementLineSchema,
  unreconcileBankStatementLineSchema,
  linkExistingJournalEntryLineSchema
} from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function revalidateBanking() {
  revalidatePath('/bancos')
  revalidatePath('/bancos/extratos')
  revalidatePath('/bancos/conciliacao')
}

function revalidateAccounting() {
  revalidatePath('/contabilidade/lancamentos')
  revalidatePath('/contabilidade/diario')
  revalidatePath('/contabilidade/balancete')
}

const revalidateBankLine = (id: string) => revalidatePath(`/bancos/conciliacao/${id}`)

// =====================================================================================
// 1. IMPORTAÇÃO DE EXTRATO CSV
// =====================================================================================

export async function importBankStatementCsvAction(rawInput: unknown): Promise<ActionResult<{ importId: string; validCount: number; invalidCount: number; duplicateCount: number }>> {
  const canImport = await canImportBankStatements()
  if (!canImport) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para importar extratos.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = importBankStatementCsvSchema.safeParse(rawInput)
  if (!validation.success) {
    return {
      ok: false,
      error: 'Erros de validação nos campos do formulário.',
      code: 'VALIDATION_ERROR',
      fieldErrors: validation.error.flatten().fieldErrors
    }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { bankAccountId, fileName, csvText } = validation.data

  try {
    // 1. Confirma que a conta bancária pertence à empresa ativa
    const { data: bankAccount, error: bankAccountError } = await db
      .from('bank_accounts')
      .select('id, company_id, active')
      .eq('id', bankAccountId)
      .single()

    if (bankAccountError || !bankAccount || bankAccount.company_id !== context.companyId) {
      return { ok: false, error: 'A conta bancária informada não existe ou pertence a outra empresa.', code: 'INVALID_BANK_ACCOUNT' }
    }
    if (!bankAccount.active) {
      return { ok: false, error: 'A conta bancária informada está inativa.', code: 'INACTIVE_BANK_ACCOUNT' }
    }

    // 2. Parsing do CSV (não exige chart_account_id — a conciliação exige, a importação não)
    const parsed = parseBankStatementCsv(csvText)

    // 3. Calcula hash e separa duplicadas (já existentes para esta conta bancária). Conta
    // repetições da mesma chave-base DENTRO do próprio lote (occurrenceIndex) para que duas
    // transações reais e distintas que coincidem em data/valor/descrição/documento (ex.:
    // duas tarifas idênticas no mesmo dia) recebam hashes diferentes em vez de colidir entre
    // si e derrubar o INSERT inteiro com "duplicate key value violates ...hash_key".
    const occurrenceCounts = new Map<string, number>()
    const rowsWithHash = parsed.validRows.map((row) => {
      const baseKey = bankLineBaseKey({
        companyId: context.companyId,
        bankAccountId,
        entryDate: row.entryDate,
        amount: row.amount,
        description: row.description,
        documentNumber: row.documentNumber
      })
      const occurrenceIndex = occurrenceCounts.get(baseKey) || 0
      occurrenceCounts.set(baseKey, occurrenceIndex + 1)

      return {
        ...row,
        hash: computeLineHash({
          companyId: context.companyId,
          bankAccountId,
          entryDate: row.entryDate,
          amount: row.amount,
          description: row.description,
          documentNumber: row.documentNumber,
          occurrenceIndex
        })
      }
    })

    const hashes = rowsWithHash.map((r) => r.hash)
    const { data: existingLines } = hashes.length > 0
      ? await db.from('bank_statement_lines').select('hash').eq('bank_account_id', bankAccountId).in('hash', hashes)
      : { data: [] }

    const existingHashes = new Set((existingLines || []).map((l: { hash: string }) => l.hash))
    const dedupedRows = rowsWithHash.filter((r) => !existingHashes.has(r.hash))
    const duplicateCount = rowsWithHash.length - dedupedRows.length

    // 4. Cria o registro de importação
    const importStatus = parsed.invalidRows.length > 0 || duplicateCount > 0 ? 'WARNING' : 'SUCCESS'
    const { data: importRow, error: importError } = await db
      .from('bank_statement_imports')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        bank_account_id: bankAccountId,
        file_name: fileName || null,
        source: 'CSV',
        status: importStatus,
        message: `Processado: ${dedupedRows.length} válida(s), ${parsed.invalidRows.length} inválida(s), ${duplicateCount} duplicada(s).`,
        total_lines: parsed.totalLines,
        valid_lines: dedupedRows.length,
        invalid_lines: parsed.invalidRows.length,
        duplicate_lines: duplicateCount
      })
      .select('id')
      .single()

    if (importError || !importRow) {
      throw importError || new Error('Falha ao registrar o lote de importação.')
    }

    // 5. Insere as linhas válidas e não-duplicadas
    if (dedupedRows.length > 0) {
      const linesToInsert = dedupedRows.map((row) => ({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        bank_account_id: bankAccountId,
        bank_statement_import_id: importRow.id,
        entry_date: row.entryDate,
        description: row.description,
        document_number: row.documentNumber || null,
        amount: row.amount,
        balance: row.balance ?? null,
        hash: row.hash,
        status: 'PENDING'
      }))

      const { error: linesError } = await db.from('bank_statement_lines').insert(linesToInsert)
      if (linesError) {
        // Limpa o registro de importação órfão (cabeçalho já criado, linhas não) antes de
        // reportar o erro, para não deixar um bank_statement_imports com contagem mentirosa.
        await db.from('bank_statement_imports').delete().eq('id', importRow.id)

        if (linesError.code === '23505') {
          return {
            ok: false,
            error: 'Uma ou mais linhas deste extrato já foram importadas nesta conta (duplicidade detectada no banco de dados) — atualize a página e tente novamente.',
            code: 'DUPLICATE_LINE'
          }
        }
        throw linesError
      }
    }

    revalidateBanking()

    return {
      ok: true,
      data: { importId: importRow.id, validCount: dedupedRows.length, invalidCount: parsed.invalidRows.length, duplicateCount },
      message: `Importação concluída: ${dedupedRows.length} linha(s) importada(s), ${parsed.invalidRows.length} inválida(s), ${duplicateCount} duplicada(s) ignorada(s).`
    }
  } catch (error: any) {
    console.error('Erro ao importar extrato bancário:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// Helpers internos de validação de classificação (compartilhados por classify/generate)
// =====================================================================================

async function loadAndValidateLineForWork(db: any, lineId: string, companyId: string) {
  const { data: line, error } = await db
    .from('bank_statement_lines')
    .select('*')
    .eq('id', lineId)
    .eq('company_id', companyId)
    .single()

  if (error || !line) {
    return { line: null, error: 'Linha de extrato não encontrada ou não pertence a esta empresa.' }
  }
  if (line.status === 'RECONCILED') {
    return { line: null, error: 'Esta linha já está conciliada. Desfaça a conciliação antes de reclassificar.' }
  }
  if (line.status === 'IGNORED') {
    return { line: null, error: 'Esta linha está marcada como ignorada e não pode ser classificada.' }
  }
  return { line, error: null }
}

async function validateCounterpartyAccount(db: any, accountId: string, companyId: string, bankChartAccountId: string) {
  if (accountId === bankChartAccountId) {
    return 'A contrapartida não pode ser a própria conta bancária (transferência entre contas não é suportada nesta etapa).'
  }

  const { data: account, error } = await db
    .from('chart_accounts')
    .select('id, company_id, is_active, is_synthetic, accepts_entries')
    .eq('id', accountId)
    .single()

  if (error || !account || account.company_id !== companyId) {
    return 'A conta de contrapartida informada não existe ou pertence a outra empresa.'
  }
  if (!account.is_active) return 'A conta de contrapartida está inativa.'
  if (account.is_synthetic || !account.accepts_entries) return 'A conta de contrapartida deve ser analítica (não sintética) e aceitar lançamentos.'

  return null
}

async function validatePartner(db: any, partnerId: string | undefined, companyId: string) {
  if (!partnerId) return null
  const { data: partner, error } = await db.from('partners').select('id, company_id').eq('id', partnerId).single()
  if (error || !partner || partner.company_id !== companyId) {
    return 'O parceiro informado não existe ou pertence a outra empresa.'
  }
  return null
}

async function validateCostCenter(db: any, costCenterId: string | undefined, companyId: string) {
  if (!costCenterId) return null
  const { data: cc, error } = await db.from('cost_centers').select('id, company_id').eq('id', costCenterId).single()
  if (error || !cc || cc.company_id !== companyId) {
    return 'O centro de custo informado não existe ou pertence a outra empresa.'
  }
  return null
}

// =====================================================================================
// 2. CLASSIFICAÇÃO MANUAL (sem gerar lançamento)
// =====================================================================================

export async function classifyBankStatementLineAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canReconcile = await canReconcileBankStatements()
  if (!canReconcile) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para classificar extratos.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = classifyBankStatementLineSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { lineId, counterpartyAccountId, partnerId, costCenterId, memo } = validation.data

  try {
    const { line, error: lineErr } = await loadAndValidateLineForWork(db, lineId, context.companyId)
    if (!line) {
      return { ok: false, error: lineErr!, code: 'INVALID_LINE_STATUS' }
    }

    const { data: bankAccount } = await db.from('bank_accounts').select('chart_account_id').eq('id', line.bank_account_id).single()
    const bankChartAccountId = bankAccount?.chart_account_id

    const counterpartyError = await validateCounterpartyAccount(db, counterpartyAccountId, context.companyId, bankChartAccountId)
    if (counterpartyError) return { ok: false, error: counterpartyError, code: 'INVALID_ACCOUNT' }

    const partnerError = await validatePartner(db, partnerId || undefined, context.companyId)
    if (partnerError) return { ok: false, error: partnerError, code: 'INVALID_PARTNER' }

    const costCenterError = await validateCostCenter(db, costCenterId || undefined, context.companyId)
    if (costCenterError) return { ok: false, error: costCenterError, code: 'INVALID_COST_CENTER' }

    const { error: updateError } = await db
      .from('bank_statement_lines')
      .update({
        counterparty_account_id: counterpartyAccountId,
        partner_id: partnerId || null,
        cost_center_id: costCenterId || null,
        classification_memo: memo || null,
        status: 'CLASSIFIED'
      })
      .eq('id', lineId)
      .eq('company_id', context.companyId)

    if (updateError) throw updateError

    revalidateBanking()
    revalidateBankLine(lineId)

    return { ok: true, data: { id: lineId }, message: 'Classificação salva. A linha ainda não foi conciliada.' }
  } catch (error: any) {
    console.error('Erro ao classificar linha de extrato:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// 3. GERAR LANÇAMENTO CONTÁBIL E CONCILIAR
// =====================================================================================

export async function generateJournalEntryFromBankLineAction(rawInput: unknown): Promise<ActionResult<{ journalEntryId: string; journalEntryNumber: number | null }>> {
  const canReconcile = await canReconcileBankStatements()
  if (!canReconcile) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para conciliar extratos.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = generateJournalEntryFromBankLineSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação nos campos do formulário.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { lineId, counterpartyAccountId, partnerId, costCenterId, memo } = validation.data

  try {
    const { line, error: lineErr } = await loadAndValidateLineForWork(db, lineId, context.companyId)
    if (!line) {
      return { ok: false, error: lineErr!, code: 'INVALID_LINE_STATUS' }
    }

    // 1. Conta bancária contábil — obrigatória, ativa, analítica
    const { data: bankAccount } = await db
      .from('bank_accounts')
      .select('id, chart_account_id, active')
      .eq('id', line.bank_account_id)
      .single()

    if (!bankAccount || !bankAccount.chart_account_id) {
      return { ok: false, error: 'A conta bancária desta linha não possui conta contábil vinculada (chart_account_id). Configure em Cadastros > Contas Bancárias antes de conciliar.', code: 'BANK_ACCOUNT_WITHOUT_CHART_ACCOUNT' }
    }
    if (!bankAccount.active) {
      return { ok: false, error: 'A conta bancária desta linha está inativa.', code: 'INACTIVE_BANK_ACCOUNT' }
    }

    const { data: bankChartAccount } = await db
      .from('chart_accounts')
      .select('id, is_active, is_synthetic, accepts_entries')
      .eq('id', bankAccount.chart_account_id)
      .single()

    if (!bankChartAccount || !bankChartAccount.is_active || bankChartAccount.is_synthetic || !bankChartAccount.accepts_entries) {
      return { ok: false, error: 'A conta contábil vinculada ao banco não está ativa/analítica. Corrija o cadastro da conta bancária.', code: 'INVALID_BANK_CHART_ACCOUNT' }
    }

    // 2. Contrapartida/parceiro/centro de custo
    const counterpartyError = await validateCounterpartyAccount(db, counterpartyAccountId, context.companyId, bankAccount.chart_account_id)
    if (counterpartyError) return { ok: false, error: counterpartyError, code: 'INVALID_ACCOUNT' }

    const partnerError = await validatePartner(db, partnerId || undefined, context.companyId)
    if (partnerError) return { ok: false, error: partnerError, code: 'INVALID_PARTNER' }

    const costCenterError = await validateCostCenter(db, costCenterId || undefined, context.companyId)
    if (costCenterError) return { ok: false, error: costCenterError, code: 'INVALID_COST_CENTER' }

    // 3. Período contábil da data da linha precisa existir e estar OPEN/REOPENED (mesmo
    // padrão de src/modules/accounting/journal/actions.ts).
    const entryDateParts = line.entry_date.split('-')
    const competenceStart = `${entryDateParts[0]}-${entryDateParts[1]}-01`

    const { data: period, error: periodError } = await db
      .from('accounting_periods')
      .select('status')
      .eq('company_id', context.companyId)
      .eq('competence', competenceStart)
      .single()

    if (periodError || !period) {
      return { ok: false, error: `Período contábil para a competência ${competenceStart} não encontrado no banco.`, code: 'PERIOD_NOT_FOUND' }
    }
    if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
      return { ok: false, error: `O período contábil (${competenceStart}) está fechado (${period.status}). Operações bloqueadas.`, code: 'PERIOD_CLOSED' }
    }

    // 4. Monta as pernas do lançamento conforme o sinal do valor
    const isInflow = Number(line.amount) > 0
    const absAmount = Math.abs(Number(line.amount))
    const historico = (memo || line.classification_memo || line.description || '').trim() || line.description

    // 5. Insere o cabeçalho como DRAFT (mesmo padrão do módulo contábil)
    const { data: newEntry, error: insertError } = await db
      .from('journal_entries')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        entry_date: line.entry_date,
        competence: competenceStart,
        description: historico,
        document: line.document_number || null,
        partner_id: partnerId || null,
        origin: 'BANK_STATEMENT',
        origin_id: line.id,
        status: 'DRAFT'
      })
      .select('id')
      .single()

    if (insertError || !newEntry) {
      throw insertError || new Error('Falha ao criar cabeçalho do lançamento de conciliação.')
    }

    const journalEntryId = newEntry.id

    // 6. Insere as 2 linhas balanceadas
    const { data: insertedLines, error: linesError } = await db
      .from('journal_entry_lines')
      .insert([
        {
          workspace_id: context.workspaceId,
          company_id: context.companyId,
          journal_entry_id: journalEntryId,
          account_id: bankAccount.chart_account_id,
          debit_credit: isInflow ? 'DEBIT' : 'CREDIT',
          amount: absAmount,
          memo: historico,
          bank_statement_line_id: line.id
        },
        {
          workspace_id: context.workspaceId,
          company_id: context.companyId,
          journal_entry_id: journalEntryId,
          account_id: counterpartyAccountId,
          debit_credit: isInflow ? 'CREDIT' : 'DEBIT',
          amount: absAmount,
          memo: historico,
          cost_center_id: costCenterId || null
        }
      ])
      .select('id, account_id')

    if (linesError || !insertedLines) {
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      throw linesError || new Error('Falha ao salvar as linhas contábeis do lançamento de conciliação.')
    }

    const bankSideLine = insertedLines.find((l: { account_id: string }) => l.account_id === bankAccount.chart_account_id)

    // 7. Efetiva (DRAFT -> POSTED) — trigger valida balanceamento e atribui numeração.
    const { data: postedEntry, error: postError } = await db
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', journalEntryId)
      .select('id, number')
      .single()

    if (postError || !postedEntry) {
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      return { ok: false, error: postError?.message || 'O banco rejeitou a publicação do lançamento de conciliação.', code: 'UNBALANCED_ENTRY' }
    }

    // 8. Concilia a linha do extrato — vínculo bidirecional (ver decisão de modelagem em
    // db/migrations/erp_schema_v1_3_bank_reconciliation_mvp.sql).
    const { error: reconcileError } = await db
      .from('bank_statement_lines')
      .update({
        counterparty_account_id: counterpartyAccountId,
        partner_id: partnerId || null,
        cost_center_id: costCenterId || null,
        classification_memo: memo || line.classification_memo || null,
        journal_entry_line_id: bankSideLine?.id || null,
        status: 'RECONCILED',
        reconciled_at: new Date().toISOString(),
        reconciled: true
      })
      .eq('id', lineId)
      .eq('company_id', context.companyId)

    if (reconcileError) throw reconcileError

    // 9. Trilha de auditoria de conciliação (tabela já existente desde a v1.1).
    await db.from('bank_reconciliations').insert({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      bank_account_id: line.bank_account_id,
      bank_statement_line_id: lineId,
      journal_entry_line_id: bankSideLine?.id
    })

    revalidateBanking()
    revalidateBankLine(lineId)
    revalidateAccounting()

    return {
      ok: true,
      data: { journalEntryId, journalEntryNumber: postedEntry.number },
      message: `Lançamento nº ${postedEntry.number} gerado e linha conciliada com sucesso!`
    }
  } catch (error: any) {
    console.error('Erro ao gerar lançamento de conciliação bancária:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// 4. IGNORAR LINHA
// =====================================================================================

export async function ignoreBankStatementLineAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canReconcile = await canReconcileBankStatements()
  if (!canReconcile) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = ignoreBankStatementLineSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Informe uma justificativa válida.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { lineId, reason } = validation.data

  try {
    const { data: line, error: findError } = await db
      .from('bank_statement_lines')
      .select('id, status')
      .eq('id', lineId)
      .eq('company_id', context.companyId)
      .single()

    if (findError || !line) {
      return { ok: false, error: 'Linha de extrato não encontrada.', code: 'LINE_NOT_FOUND' }
    }
    if (line.status === 'RECONCILED') {
      return { ok: false, error: 'Uma linha já conciliada não pode ser ignorada — desfaça a conciliação primeiro.', code: 'INVALID_LINE_STATUS' }
    }

    const { error: updateError } = await db
      .from('bank_statement_lines')
      .update({ status: 'IGNORED', classification_memo: reason })
      .eq('id', lineId)
      .eq('company_id', context.companyId)

    if (updateError) throw updateError

    revalidateBanking()
    revalidateBankLine(lineId)

    return { ok: true, data: { id: lineId }, message: 'Linha marcada como ignorada.' }
  } catch (error: any) {
    console.error('Erro ao ignorar linha de extrato:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// 5. DESFAZER CONCILIAÇÃO (não apaga o lançamento contábil)
// =====================================================================================

export async function unreconcileBankStatementLineAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canReconcile = await canReconcileBankStatements()
  if (!canReconcile) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = unreconcileBankStatementLineSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { lineId } = validation.data

  try {
    const { data: line, error: findError } = await db
      .from('bank_statement_lines')
      .select('id, status, journal_entry_line_id')
      .eq('id', lineId)
      .eq('company_id', context.companyId)
      .single()

    if (findError || !line) {
      return { ok: false, error: 'Linha de extrato não encontrada.', code: 'LINE_NOT_FOUND' }
    }
    if (line.status !== 'RECONCILED') {
      return { ok: false, error: 'Só é possível desfazer a conciliação de uma linha atualmente RECONCILED.', code: 'INVALID_LINE_STATUS' }
    }

    const previousJournalEntryLineId = line.journal_entry_line_id

    // Remove o vínculo e volta para PENDING. NÃO apaga nem altera o journal_entry — se o
    // lançamento em si precisar ser desfeito, isso deve ser feito pelo módulo contábil
    // (estorno via /contabilidade/lancamentos), nunca por DELETE aqui.
    const { error: updateError } = await db
      .from('bank_statement_lines')
      .update({
        journal_entry_line_id: null,
        status: 'PENDING',
        reconciled_at: null,
        reconciled: false
      })
      .eq('id', lineId)
      .eq('company_id', context.companyId)

    if (updateError) throw updateError

    // Mantém a perna do lançamento em si intacta, mas remove o vínculo denormalizado
    // reverso (journal_entry_lines.bank_statement_line_id) para não apontar mais para uma
    // linha "desconciliada".
    if (previousJournalEntryLineId) {
      await db.from('journal_entry_lines').update({ bank_statement_line_id: null }).eq('id', previousJournalEntryLineId)
    }

    // Registra o evento de desconciliação na trilha de auditoria já existente.
    await db
      .from('bank_reconciliations')
      .update({ unreconciled_at: new Date().toISOString() })
      .eq('bank_statement_line_id', lineId)
      .is('unreconciled_at', null)

    revalidateBanking()
    revalidateBankLine(lineId)

    return {
      ok: true,
      data: { id: lineId },
      message: 'Conciliação desfeita. O lançamento contábil NÃO foi apagado — se ele também precisar ser desfeito, estorne-o em Lançamentos.'
    }
  } catch (error: any) {
    console.error('Erro ao desfazer conciliação de linha de extrato:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// 6. VINCULAR A LANÇAMENTO CONTÁBIL EXISTENTE (opcional — item 7 da Etapa 18)
// =====================================================================================

export async function linkExistingJournalEntryLineAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const canReconcile = await canReconcileBankStatements()
  if (!canReconcile) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = linkExistingJournalEntryLineSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const { lineId, journalEntryLineId } = validation.data

  try {
    const { line, error: lineErr } = await loadAndValidateLineForWork(db, lineId, context.companyId)
    if (!line) {
      return { ok: false, error: lineErr!, code: 'INVALID_LINE_STATUS' }
    }

    const { data: bankAccount } = await db.from('bank_accounts').select('chart_account_id').eq('id', line.bank_account_id).single()
    if (!bankAccount?.chart_account_id) {
      return { ok: false, error: 'A conta bancária desta linha não possui conta contábil vinculada.', code: 'BANK_ACCOUNT_WITHOUT_CHART_ACCOUNT' }
    }

    const { data: targetLine, error: targetError } = await db
      .from('journal_entry_lines')
      .select('id, company_id, account_id, debit_credit, amount, bank_statement_line_id, journal_entries!inner(status)')
      .eq('id', journalEntryLineId)
      .single()

    if (targetError || !targetLine || targetLine.company_id !== context.companyId) {
      return { ok: false, error: 'O lançamento informado não existe ou pertence a outra empresa.', code: 'INVALID_JOURNAL_ENTRY_LINE' }
    }
    if (targetLine.bank_statement_line_id) {
      return { ok: false, error: 'Este lançamento já está vinculado a outra linha de extrato.', code: 'ALREADY_LINKED' }
    }
    if ((targetLine.journal_entries as any)?.status !== 'POSTED') {
      return { ok: false, error: 'Só é possível vincular a um lançamento já POSTED.', code: 'INVALID_JOURNAL_ENTRY_STATUS' }
    }
    if (targetLine.account_id !== bankAccount.chart_account_id) {
      return { ok: false, error: 'O lançamento selecionado não toca a conta contábil desta conta bancária.', code: 'ACCOUNT_MISMATCH' }
    }

    const expectedSide = Number(line.amount) > 0 ? 'DEBIT' : 'CREDIT'
    if (targetLine.debit_credit !== expectedSide) {
      return { ok: false, error: `O sentido do lançamento (${targetLine.debit_credit}) não corresponde ao da linha de extrato (esperado ${expectedSide}).`, code: 'DIRECTION_MISMATCH' }
    }
    if (Math.abs(Number(targetLine.amount) - Math.abs(Number(line.amount))) > 0.01) {
      return { ok: false, error: 'O valor do lançamento selecionado não corresponde ao valor da linha de extrato.', code: 'AMOUNT_MISMATCH' }
    }

    const { error: updateLineError } = await db
      .from('bank_statement_lines')
      .update({
        journal_entry_line_id: journalEntryLineId,
        status: 'RECONCILED',
        reconciled_at: new Date().toISOString(),
        reconciled: true
      })
      .eq('id', lineId)
      .eq('company_id', context.companyId)

    if (updateLineError) throw updateLineError

    await db.from('journal_entry_lines').update({ bank_statement_line_id: lineId }).eq('id', journalEntryLineId)

    await db.from('bank_reconciliations').insert({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      bank_account_id: line.bank_account_id,
      bank_statement_line_id: lineId,
      journal_entry_line_id: journalEntryLineId
    })

    revalidateBanking()
    revalidateBankLine(lineId)

    return { ok: true, data: { id: lineId }, message: 'Linha vinculada ao lançamento existente e conciliada com sucesso!' }
  } catch (error: any) {
    console.error('Erro ao vincular linha de extrato a lançamento existente:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
