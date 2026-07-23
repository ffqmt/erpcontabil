'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { canManagePayroll } from '@/lib/permissions/permissions'
import { getClient } from '@/lib/supabase/server'
import { parseEsocialXml } from './esocial-parser'
import { accountPayrollEventSchema, importEsocialXmlSchema } from './validations'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function normalizeDocument(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function employerMatchesCompany(companyCnpj: string | null, employerRegistration: string | null): boolean {
  if (!companyCnpj || !employerRegistration) return true
  return companyCnpj === employerRegistration || companyCnpj.startsWith(employerRegistration) || employerRegistration.startsWith(companyCnpj)
}

function revalidatePayroll() {
  revalidatePath('/folha')
  revalidatePath('/folha/importar-esocial')
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

interface PayrollJournalLine {
  accountId: string
  debitCredit: 'DEBIT' | 'CREDIT'
  amount: number
  memo: string
}

function optionalAccount(value: string | null | undefined): string | null {
  return value && value.trim() ? value : null
}

function requireAccount(accountId: string | null, message: string): { accountId: string } | { error: string; code: string } {
  if (!accountId) return { error: message, code: 'ACCOUNT_REQUIRED' }
  return { accountId }
}

function addLine(lines: PayrollJournalLine[], accountId: string, debitCredit: 'DEBIT' | 'CREDIT', amount: number, memo: string) {
  const rounded = roundCurrency(amount)
  if (rounded <= 0) return
  lines.push({ accountId, debitCredit, amount: rounded, memo })
}

async function registerImportAudit(params: {
  workspaceId: string
  companyId: string
  fileName: string | null
  importHash: string
  eventId: string | null
  eventType: string
  importStatus: 'IMPORTED' | 'DUPLICATE' | 'ERROR'
  xmlText: string
  parsedPayload: unknown
  parseErrors: string[]
}) {
  const db = await getDb()
  const { data, error } = await db
    .from('payroll_esocial_imports')
    .insert({
      workspace_id: params.workspaceId,
      company_id: params.companyId,
      file_name: params.fileName,
      import_hash: params.importHash,
      event_id: params.eventId,
      event_type: params.eventType,
      import_status: params.importStatus,
      xml_raw: params.xmlText,
      parsed_payload: params.parsedPayload,
      parse_errors: params.parseErrors.length > 0 ? params.parseErrors : null
    })
    .select('id')
    .single()

  if (error || !data) throw error || new Error('Falha ao registrar auditoria de importação do eSocial.')
  return data.id as string
}

export async function importEsocialXmlAction(rawInput: unknown): Promise<ActionResult<{ id: string; eventType: string; itemCount: number }>> {
  if (!(await canManagePayroll())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para importar folha.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = importEsocialXmlSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const xmlText = validation.data.xmlText
  const fileName = validation.data.fileName || null
  const importHash = sha256(xmlText)
  const parsed = parseEsocialXml(xmlText)
  const messages = [...parsed.errors, ...parsed.warnings]

  try {
    const { data: company } = await db
      .from('companies')
      .select('cnpj')
      .eq('id', context.companyId)
      .single()

    const companyCnpj = normalizeDocument(company?.cnpj)
    if (!employerMatchesCompany(companyCnpj, parsed.employerRegistration)) {
      messages.push(`A inscrição do empregador no XML (${parsed.employerRegistration || '—'}) não confere com o CNPJ da empresa ativa (${companyCnpj || '—'}).`)
    }

    const hasBlockingError = parsed.errors.length > 0 || messages.some((message) => message.includes('não confere'))

    if (parsed.eventId) {
      const { data: existingEvent } = await db
        .from('payroll_esocial_events')
        .select('id')
        .eq('company_id', context.companyId)
        .eq('event_id', parsed.eventId)
        .maybeSingle()

      if (existingEvent) {
        await registerImportAudit({
          workspaceId: context.workspaceId,
          companyId: context.companyId,
          fileName,
          importHash,
          eventId: parsed.eventId,
          eventType: parsed.eventType,
          importStatus: 'DUPLICATE',
          xmlText,
          parsedPayload: parsed.parsedPayload,
          parseErrors: [`Evento ${parsed.eventId} já importado anteriormente.`]
        })
        revalidatePayroll()
        return { ok: false, error: `Evento ${parsed.eventId} já importado anteriormente.`, code: 'DUPLICATE_EVENT' }
      }
    } else {
      const { data: existingHash } = await db
        .from('payroll_esocial_imports')
        .select('id')
        .eq('company_id', context.companyId)
        .eq('import_hash', importHash)
        .eq('import_status', 'IMPORTED')
        .maybeSingle()

      if (existingHash) {
        await registerImportAudit({
          workspaceId: context.workspaceId,
          companyId: context.companyId,
          fileName,
          importHash,
          eventId: null,
          eventType: parsed.eventType,
          importStatus: 'DUPLICATE',
          xmlText,
          parsedPayload: parsed.parsedPayload,
          parseErrors: ['XML sem ID de evento já importado anteriormente pelo mesmo hash.']
        })
        revalidatePayroll()
        return { ok: false, error: 'XML já importado anteriormente pelo mesmo hash.', code: 'DUPLICATE_XML' }
      }
    }

    const importId = await registerImportAudit({
      workspaceId: context.workspaceId,
      companyId: context.companyId,
      fileName,
      importHash,
      eventId: parsed.eventId,
      eventType: parsed.eventType,
      importStatus: hasBlockingError ? 'ERROR' : 'IMPORTED',
      xmlText,
      parsedPayload: parsed.parsedPayload,
      parseErrors: messages
    })

    if (hasBlockingError) {
      revalidatePayroll()
      return { ok: false, error: messages[0] || 'XML do eSocial possui erro de importação.', code: 'PARSE_ERROR' }
    }

    const { data: eventRow, error: eventError } = await db
      .from('payroll_esocial_events')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        import_id: importId,
        event_id: parsed.eventId,
        event_type: parsed.eventType,
        event_name: parsed.eventName,
        employer_registration: parsed.employerRegistration,
        period_competence: parsed.periodCompetence,
        payment_date: parsed.paymentDate,
        worker_cpf: parsed.workerCpf,
        worker_name: parsed.workerName,
        worker_registration: parsed.workerRegistration,
        worker_category: parsed.workerCategory,
        gross_amount: parsed.grossAmount,
        deductions_amount: parsed.deductionsAmount,
        net_amount: parsed.netAmount,
        inss_employee_amount: parsed.inssEmployeeAmount,
        irrf_amount: parsed.irrfAmount,
        fgts_amount: parsed.fgtsAmount,
        employer_inss_amount: parsed.employerInssAmount,
        other_amount: parsed.otherAmount,
        accounting_status: 'NOT_ACCOUNTED',
        event_payload: parsed.eventPayload
      })
      .select('id')
      .single()

    if (eventError || !eventRow) throw eventError || new Error('Falha ao gravar evento do eSocial.')

    if (parsed.items.length > 0) {
      const { error: itemsError } = await db.from('payroll_esocial_event_items').insert(
        parsed.items.map((item, index) => ({
          workspace_id: context.workspaceId,
          company_id: context.companyId,
          payroll_event_id: eventRow.id,
          item_order: index + 1,
          line_type: item.lineType,
          rubric_code: item.rubricCode,
          rubric_table: item.rubricTable,
          rubric_nature: item.rubricNature,
          description: item.description,
          reference_value: item.referenceValue,
          quantity: item.quantity,
          factor: item.factor,
          amount: item.amount,
          raw_payload: item.rawPayload
        }))
      )

      if (itemsError) throw itemsError
    }

    revalidatePayroll()
    return {
      ok: true,
      data: { id: eventRow.id as string, eventType: parsed.eventType, itemCount: parsed.items.length },
      message: `Evento ${parsed.eventType} importado com ${parsed.items.length} rubrica(s).`
    }
  } catch (error: unknown) {
    console.error('Erro ao importar XML do eSocial:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function accountPayrollEventAction(rawInput: unknown): Promise<ActionResult<{ journalEntryId: string; journalEntryNumber: number | null }>> {
  if (!(await canManagePayroll())) {
    return { ok: false, error: 'Acesso negado: permissões insuficientes para contabilizar folha.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  const validation = accountPayrollEventSchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }
  }

  const context = await getCurrentContext()
  const db = await getDb()
  const input = validation.data

  try {
    const { data: event } = await db
      .from('payroll_esocial_events')
      .select('*')
      .eq('id', input.id)
      .eq('company_id', context.companyId)
      .single()

    if (!event) return { ok: false, error: 'Evento eSocial não encontrado.', code: 'NOT_FOUND' }
    if (event.accounting_status === 'ACCOUNTED') {
      return { ok: false, error: 'Este evento já foi integrado à contabilidade.', code: 'ALREADY_ACCOUNTED' }
    }

    const competence = event.period_competence || (event.payment_date ? `${String(event.payment_date).substring(0, 7)}-01` : null)
    if (!competence) {
      return { ok: false, error: 'Evento sem competência identificada. Reimporte ou ajuste o XML antes de contabilizar.', code: 'INVALID_COMPETENCE' }
    }

    const entryDate = event.payment_date || competence
    const { data: period } = await db
      .from('accounting_periods')
      .select('status')
      .eq('company_id', context.companyId)
      .eq('competence', competence)
      .single()

    if (!period) return { ok: false, error: `Período contábil para a competência ${competence} não encontrado.`, code: 'PERIOD_NOT_FOUND' }
    if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
      return { ok: false, error: `O período contábil (${competence}) está fechado (${period.status}).`, code: 'PERIOD_CLOSED' }
    }

    const grossAmount = roundCurrency(Number(event.gross_amount || 0))
    const netAmount = roundCurrency(Number(event.net_amount || 0))
    const inssEmployeeAmount = roundCurrency(Number(event.inss_employee_amount || 0))
    const irrfAmount = roundCurrency(Number(event.irrf_amount || 0))
    const fgtsAmount = roundCurrency(Number(event.fgts_amount || 0))
    const employerInssAmount = roundCurrency(Number(event.employer_inss_amount || 0))
    const knownEmployeeDeductions = roundCurrency(inssEmployeeAmount + irrfAmount)
    const otherDeductionsAmount = roundCurrency(Math.max(0, grossAmount - netAmount - knownEmployeeDeductions))
    const workerLabel = event.worker_name || event.worker_cpf || event.event_id || event.id
    const memoBase = `${event.event_type} ${workerLabel} - ${String(competence).substring(0, 7)}`
    const lines: PayrollJournalLine[] = []
    let journalOrigin: 'PAYROLL_SUMMARY' | 'PAYROLL_PAYMENT' = 'PAYROLL_SUMMARY'

    const salariesPayable = input.salariesPayableAccountId

    if (grossAmount > 0) {
      const salaryExpense = requireAccount(optionalAccount(input.salaryExpenseAccountId), 'Selecione a conta de despesa de salários/remuneração.')
      if ('error' in salaryExpense) return { ok: false, error: salaryExpense.error, code: salaryExpense.code }

      addLine(lines, salaryExpense.accountId, 'DEBIT', grossAmount, `Despesa de remuneração - ${memoBase}`)
      addLine(lines, salariesPayable, 'CREDIT', netAmount, `Líquido de folha a pagar - ${memoBase}`)

      if (inssEmployeeAmount > 0) {
        const inssPayable = requireAccount(optionalAccount(input.inssPayableAccountId), 'Selecione a conta de INSS a recolher para o desconto do empregado.')
        if ('error' in inssPayable) return { ok: false, error: inssPayable.error, code: inssPayable.code }
        addLine(lines, inssPayable.accountId, 'CREDIT', inssEmployeeAmount, `INSS descontado - ${memoBase}`)
      }

      if (irrfAmount > 0) {
        const irrfPayable = requireAccount(optionalAccount(input.irrfPayableAccountId), 'Selecione a conta de IRRF a recolher.')
        if ('error' in irrfPayable) return { ok: false, error: irrfPayable.error, code: irrfPayable.code }
        addLine(lines, irrfPayable.accountId, 'CREDIT', irrfAmount, `IRRF descontado - ${memoBase}`)
      }

      if (otherDeductionsAmount > 0.009) {
        const otherDeductions = requireAccount(optionalAccount(input.otherDeductionsAccountId), 'Selecione a conta para outros descontos da folha.')
        if ('error' in otherDeductions) return { ok: false, error: otherDeductions.error, code: otherDeductions.code }
        addLine(lines, otherDeductions.accountId, 'CREDIT', otherDeductionsAmount, `Outros descontos - ${memoBase}`)
      }

      if (fgtsAmount > 0) {
        const fgtsExpense = requireAccount(optionalAccount(input.fgtsExpenseAccountId), 'Selecione a conta de despesa de FGTS.')
        if ('error' in fgtsExpense) return { ok: false, error: fgtsExpense.error, code: fgtsExpense.code }
        const fgtsPayable = requireAccount(optionalAccount(input.fgtsPayableAccountId), 'Selecione a conta de FGTS a recolher.')
        if ('error' in fgtsPayable) return { ok: false, error: fgtsPayable.error, code: fgtsPayable.code }
        addLine(lines, fgtsExpense.accountId, 'DEBIT', fgtsAmount, `Despesa de FGTS - ${memoBase}`)
        addLine(lines, fgtsPayable.accountId, 'CREDIT', fgtsAmount, `FGTS a recolher - ${memoBase}`)
      }

      if (employerInssAmount > 0) {
        const inssExpense = requireAccount(optionalAccount(input.employerInssExpenseAccountId), 'Selecione a conta de despesa de INSS patronal.')
        if ('error' in inssExpense) return { ok: false, error: inssExpense.error, code: inssExpense.code }
        const inssPayable = requireAccount(optionalAccount(input.employerInssPayableAccountId || input.inssPayableAccountId), 'Selecione a conta de INSS patronal a recolher.')
        if ('error' in inssPayable) return { ok: false, error: inssPayable.error, code: inssPayable.code }
        addLine(lines, inssExpense.accountId, 'DEBIT', employerInssAmount, `Despesa de INSS patronal - ${memoBase}`)
        addLine(lines, inssPayable.accountId, 'CREDIT', employerInssAmount, `INSS patronal a recolher - ${memoBase}`)
      }
    } else if (netAmount > 0) {
      journalOrigin = 'PAYROLL_PAYMENT'
      const paymentAccount = requireAccount(optionalAccount(input.paymentAccountId), 'Selecione a conta de pagamento/banco para baixar a folha a pagar.')
      if ('error' in paymentAccount) return { ok: false, error: paymentAccount.error, code: paymentAccount.code }
      addLine(lines, salariesPayable, 'DEBIT', netAmount, `Baixa de folha a pagar - ${memoBase}`)
      addLine(lines, paymentAccount.accountId, 'CREDIT', netAmount, `Pagamento de folha - ${memoBase}`)
    } else {
      return { ok: false, error: 'Evento sem valores suficientes para gerar lançamento contábil.', code: 'NO_ACCOUNTING_AMOUNT' }
    }

    const totalDebits = lines.filter((line) => line.debitCredit === 'DEBIT').reduce((sum, line) => sum + Math.round(line.amount * 100), 0)
    const totalCredits = lines.filter((line) => line.debitCredit === 'CREDIT').reduce((sum, line) => sum + Math.round(line.amount * 100), 0)
    if (totalDebits !== totalCredits || lines.length < 2) {
      return { ok: false, error: 'As partidas de folha ficaram desequilibradas. Revise as contas e valores extraídos.', code: 'UNBALANCED_ENTRY' }
    }

    const accountIds = Array.from(new Set(lines.map((line) => line.accountId)))
    const { data: accounts, error: accountsError } = await db
      .from('chart_accounts')
      .select('id, company_id, is_active, is_synthetic, accepts_entries')
      .in('id', accountIds)

    if (accountsError || !accounts || accounts.length !== accountIds.length) {
      return { ok: false, error: 'Uma ou mais contas contábeis selecionadas não foram encontradas.', code: 'INVALID_ACCOUNT' }
    }

    for (const account of accounts) {
      if (account.company_id !== context.companyId) return { ok: false, error: 'Conta contábil pertence a outra empresa.', code: 'INVALID_ACCOUNT' }
      if (!account.is_active || account.is_synthetic || !account.accepts_entries) {
        return { ok: false, error: 'As contas selecionadas devem ser analíticas, ativas e aceitar lançamentos.', code: 'INVALID_ACCOUNT' }
      }
    }

    const { data: newEntry, error: entryError } = await db
      .from('journal_entries')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        entry_date: entryDate,
        competence,
        description: `Integração folha eSocial ${event.event_type} - ${workerLabel}`,
        document: event.event_id || null,
        origin: journalOrigin,
        origin_id: event.id,
        status: 'DRAFT'
      })
      .select('id')
      .single()

    if (entryError || !newEntry) throw entryError || new Error('Falha ao criar lançamento da folha.')

    const journalEntryId = newEntry.id as string
    const { error: linesError } = await db.from('journal_entry_lines').insert(
      lines.map((line) => ({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        journal_entry_id: journalEntryId,
        account_id: line.accountId,
        debit_credit: line.debitCredit,
        amount: line.amount,
        memo: line.memo
      }))
    )

    if (linesError) {
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      throw linesError
    }

    const { data: posted, error: postError } = await db
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', journalEntryId)
      .select('id, number')
      .single()

    if (postError || !posted) {
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      return { ok: false, error: postError?.message || 'O banco rejeitou a postagem do lançamento da folha.', code: 'UNBALANCED_ENTRY' }
    }

    await db
      .from('payroll_esocial_events')
      .update({ accounting_status: 'ACCOUNTED', journal_entry_id: journalEntryId })
      .eq('id', event.id)
      .eq('company_id', context.companyId)

    revalidatePayroll()
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')
    revalidatePath('/contabilidade/dre')

    return {
      ok: true,
      data: { journalEntryId, journalEntryNumber: posted.number as number | null },
      message: `Lançamento nº ${posted.number || '—'} gerado na contabilidade.`
    }
  } catch (error: unknown) {
    console.error('Erro ao contabilizar evento de folha:', error)
    await db.from('payroll_esocial_events').update({ accounting_status: 'ACCOUNTING_ERROR' }).eq('id', input.id).eq('company_id', context.companyId)
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
