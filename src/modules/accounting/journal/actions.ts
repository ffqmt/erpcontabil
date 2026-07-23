'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { createManualJournalEntrySchema, postJournalEntrySchema, reverseJournalEntrySchema } from './validations'
import { getUserPermissions } from '@/lib/permissions/permissions'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

/**
 * Server Action para salvar um lançamento contábil manual como DRAFT (Rascunho).
 */
export async function createManualJournalEntryAction(
  rawInput: unknown
): Promise<ActionResult<{ id: string }>> {
  const context = await getCurrentContext()
  const perms = await getUserPermissions()
  const canWrite = perms.permissions.includes('accounting:write') || perms.permissions.includes('*')

  // 1. Validar permissão básica de escrita
  if (!canWrite) {
    return { ok: false, error: 'Acesso negado: permissões de escrita insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  // 2. Validar entrada Zod
  const validation = createManualJournalEntrySchema.safeParse(rawInput)
  if (!validation.success) {
    const fieldErrors = validation.error.flatten().fieldErrors
    return {
      ok: false,
      error: 'Erros de validação nos campos do formulário.',
      code: 'VALIDATION_ERROR',
      fieldErrors
    }
  }

  const { entryDate, description, document, partnerId, lines } = validation.data

  const dateParts = entryDate.split('-')
  const competenceStart = `${dateParts[0]}-${dateParts[1]}-01`

  const db = await getClient()

  try {
    // 5. Verificar se o período da data do lançamento existe e está aberto.
    const { data: period, error: periodError } = await db
      .from('accounting_periods')
      .select('status')
      .eq('company_id', context.companyId)
      .eq('competence', competenceStart)
      .single()

    if (periodError || !period) {
      return { ok: false, error: 'Período contábil para a competência não encontrado no banco.', code: 'PERIOD_NOT_FOUND' }
    }

    if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
      return { ok: false, error: `O período contábil (${competenceStart}) está fechado (${period.status}). Operações bloqueadas.`, code: 'PERIOD_CLOSED' }
    }

    // 6. Validar contas contábeis utilizadas nas linhas
    const accountIds = lines.map((l) => l.accountId)
    const { data: dbAccounts, error: accError } = await db
      .from('chart_accounts')
      .select('id, company_id, is_active, is_synthetic, accepts_entries')
      .in('id', accountIds)

    if (accError || !dbAccounts || dbAccounts.length !== Array.from(new Set(accountIds)).length) {
      return { ok: false, error: 'Uma ou mais contas contábeis selecionadas não foram encontradas no plano.', code: 'INVALID_ACCOUNT' }
    }

    // Valida regras de negócio em cada conta contábil
    for (const acc of dbAccounts) {
      if (acc.company_id !== context.companyId) {
        return { ok: false, error: 'Conta contábil pertence a outra empresa.', code: 'INVALID_ACCOUNT' }
      }
      if (!acc.is_active) {
        return { ok: false, error: 'Lançamento rejeitado: conta contábil inativa.', code: 'INACTIVE_ACCOUNT' }
      }
      if (acc.is_synthetic) {
        return { ok: false, error: 'Lançamento rejeitado: não é permitido lançar em conta sintética.', code: 'SYNTHETIC_ACCOUNT' }
      }
      if (!acc.accepts_entries) {
        return { ok: false, error: 'Lançamento rejeitado: conta configurada para não aceitar lançamentos.', code: 'INVALID_ACCOUNT' }
      }
    }

    // 7. Validar balanceamento (Débitos == Créditos) em centavos para consistência
    let totalDebitsCents = 0
    let totalCreditsCents = 0
    lines.forEach((l) => {
      const cents = Math.round(l.amount * 100)
      if (l.debitCredit === 'DEBIT') {
        totalDebitsCents += cents
      } else {
        totalCreditsCents += cents
      }
    })

    if (totalDebitsCents !== totalCreditsCents) {
      return { ok: false, error: 'Lançamento desequilibrado. A soma dos débitos deve ser igual à soma dos créditos.', code: 'UNBALANCED_ENTRY' }
    }

    // 7b. Valida parceiro opcional (mesma empresa)
    if (partnerId) {
      const { data: partner, error: partnerError } = await db.from('partners').select('id, company_id').eq('id', partnerId).single()
      if (partnerError || !partner || partner.company_id !== context.companyId) {
        return { ok: false, error: 'O parceiro informado não existe ou pertence a outra empresa.', code: 'INVALID_PARTNER' }
      }
    }

    // 8. Inserir o cabeçalho do lançamento como DRAFT
    const { data: newEntry, error: insertError } = await db
      .from('journal_entries')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        entry_date: entryDate,
        competence: competenceStart,
        description,
        document: document || null,
        partner_id: partnerId || null,
        origin: 'MANUAL',
        status: 'DRAFT'
      })
      .select('id')
      .single()

    if (insertError || !newEntry) {
      throw insertError || new Error('Erro ao registrar cabeçalho do lançamento.')
    }

    const journalEntryId = newEntry.id

    // 9. Inserir as linhas do lançamento
    const linesToInsert = lines.map((l) => ({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      journal_entry_id: journalEntryId,
      account_id: l.accountId,
      debit_credit: l.debitCredit,
      amount: l.amount,
      memo: l.memo || null,
      cost_center_id: l.costCenterId || null
    }))

    const { error: linesInsertError } = await db
      .from('journal_entry_lines')
      .insert(linesToInsert)

    if (linesInsertError) {
      // Aborta e remove o rascunho órfão caso as linhas falhem (limpeza preventiva)
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      throw linesInsertError
    }

    // 10. Revalidar caches e retornar
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')

    return { ok: true, data: { id: journalEntryId }, message: 'Lançamento salvo como Rascunho com sucesso!' }
  } catch (error: any) {
    console.error('Erro na gravação do rascunho de lançamento manual:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

/**
 * Server Action para postar/publicar um lançamento DRAFT existente.
 */
export async function postJournalEntryAction(
  rawInput: unknown
): Promise<ActionResult<{ status: string; number: number }>> {
  const context = await getCurrentContext()
  const perms = await getUserPermissions()
  const canWrite = perms.permissions.includes('accounting:write') || perms.permissions.includes('*')

  // 1. Validar permissões
  if (!canWrite) {
    return { ok: false, error: 'Acesso negado: permissões de escrita insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  // 2. Validar input Zod
  const validation = postJournalEntrySchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'ID de lançamento contábil inválido para postagem.', code: 'VALIDATION_ERROR' }
  }

  const { journalEntryId } = validation.data

  const db = await getClient()

  try {
    // 3. Buscar o lançamento ativo e certificar que é DRAFT e da empresa ativa
    const { data: entry, error: findError } = await db
      .from('journal_entries')
      .select('*')
      .eq('id', journalEntryId)
      .eq('company_id', context.companyId)
      .single()

    if (findError || !entry) {
      return { ok: false, error: 'Lançamento não encontrado ou não pertence a esta empresa.', code: 'PERIOD_NOT_FOUND' }
    }

    // Validar período contábil aberto
    const { data: period, error: periodError } = await db
      .from('accounting_periods')
      .select('status')
      .eq('company_id', context.companyId)
      .eq('competence', entry.competence)
      .single()

    if (periodError || !period) {
      return { ok: false, error: 'Período contábil para a competência não encontrado no banco.', code: 'PERIOD_NOT_FOUND' }
    }

    if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
      return { ok: false, error: `O período contábil (${entry.competence}) está fechado (${period.status}). Operações bloqueadas.`, code: 'PERIOD_CLOSED' }
    }

    if (entry.status !== 'DRAFT') {
      return { ok: false, error: `Só é possível postar lançamentos em Rascunho (status atual: ${entry.status}).`, code: 'UNBALANCED_ENTRY' }
    }

    // 4. Buscar linhas
    const { data: lines, error: linesError } = await db
      .from('journal_entry_lines')
      .select('*')
      .eq('journal_entry_id', journalEntryId)

    if (linesError || !lines || lines.length < 2) {
      return { ok: false, error: 'O lançamento contábil não possui linhas suficientes (partidas dobradas) para ser postado.', code: 'UNBALANCED_ENTRY' }
    }

    // 5. Validar novamente equilíbrio em centavos
    let totalDebitsCents = 0
    let totalCreditsCents = 0
    lines.forEach((l: any) => {
      const amountNum = typeof l.amount === 'string' ? parseFloat(l.amount) : l.amount
      const cents = Math.round(amountNum * 100)
      if (l.debit_credit === 'DEBIT') {
        totalDebitsCents += cents
      } else {
        totalCreditsCents += cents
      }
    })

    if (totalDebitsCents !== totalCreditsCents) {
      return { ok: false, error: 'Lançamento desequilibrado. A soma dos débitos difere da soma dos créditos.', code: 'UNBALANCED_ENTRY' }
    }

    // 6. Efetivar postagem: altera status para POSTED
    // Os triggers do banco validarão as contas, períodos abertos e atribuirão o number oficial automaticamente
    const { data: updatedEntry, error: postError } = await db
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', journalEntryId)
      .select('status, number')
      .single()

    if (postError) {
      // Captura erros amigáveis das triggers do banco (ex: período fechado ou estouro)
      return {
        ok: false,
        error: postError.message || 'O banco rejeitou a postagem do lançamento contábil.',
        code: postError.code === '23514' ? 'UNBALANCED_ENTRY' : 'DATABASE_ERROR'
      }
    }

    // 7. Revalidar caches e retornar
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')

    return {
      ok: true,
      data: {
        status: updatedEntry.status,
        number: updatedEntry.number
      },
      message: `Lançamento postado com sucesso! Recebeu o número oficial contábil: nº ${updatedEntry.number}`
    }
  } catch (error: any) {
    console.error('Erro na postagem do lançamento contábil:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

/**
 * Server Action para estornar (reverter) um lançamento contábil POSTED existente.
 * Utiliza a stored procedure transacional `reverse_journal_entry` do banco de dados.
 */
export async function reverseJournalEntryAction(
  rawInput: unknown
): Promise<ActionResult<{ newEntryId: string }>> {
  const context = await getCurrentContext()
  const perms = await getUserPermissions()
  const canWrite = perms.permissions.includes('accounting:write') || perms.permissions.includes('*')

  // 1. Validar permissões
  if (!canWrite) {
    return { ok: false, error: 'Acesso negado: permissões de escrita insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  // 2. Validar input Zod
  const validation = reverseJournalEntrySchema.safeParse(rawInput)
  if (!validation.success) {
    return { ok: false, error: 'Erros de validação na requisição de estorno.', code: 'VALIDATION_ERROR' }
  }

  const { journalEntryId, reason } = validation.data

  const db = await getClient()

  try {
    // 3. Buscar o lançamento original para certificar que pertence à empresa ativa
    const { data: entry, error: findError } = await db
      .from('journal_entries')
      .select('id, status, number, competence')
      .eq('id', journalEntryId)
      .eq('company_id', context.companyId)
      .single()

    if (findError || !entry) {
      return { ok: false, error: 'Lançamento original não encontrado ou pertence a outra empresa.', code: 'PERIOD_NOT_FOUND' }
    }

    if (entry.status !== 'POSTED') {
      return { ok: false, error: `Só é possível estornar lançamentos contábeis publicados (status atual: ${entry.status}).`, code: 'UNBALANCED_ENTRY' }
    }

    // Validar período contábil aberto
    const { data: period, error: periodError } = await db
      .from('accounting_periods')
      .select('status')
      .eq('company_id', context.companyId)
      .eq('competence', entry.competence)
      .single()

    if (periodError || !period) {
      return { ok: false, error: 'Período contábil para a competência não encontrado no banco.', code: 'PERIOD_NOT_FOUND' }
    }

    if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
      return { ok: false, error: `O período contábil (${entry.competence}) está fechado (${period.status}). Operações bloqueadas.`, code: 'PERIOD_CLOSED' }
    }

    // 4. Chamar a RPC reverse_journal_entry no banco (efetua todo o estorno transacionalmente)
    // Tenta primeiro usando o banco ativo
    let rpcRes = await db.rpc('reverse_journal_entry', {
      p_entry_id: journalEntryId,
      p_reason: reason
    })

    // RPC executada sob a sessão do usuário ativo (User Client)

    if (rpcRes.error) {
      console.error('Erro na stored procedure SQL de estorno:', rpcRes.error)
      return {
        ok: false,
        error: rpcRes.error.message || 'O banco rejeitou a operação de estorno.',
        code: 'DATABASE_ERROR'
      }
    }

    const newEntryId = rpcRes.data

    // 5. Revalidar caches e relatórios contábeis afetados
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')
    revalidatePath('/contabilidade/dre')
    revalidatePath('/contabilidade/balanco')

    return {
      ok: true,
      data: { newEntryId },
      message: `Lançamento estornado com sucesso! Criado lançamento de estorno nº ${newEntryId}`
    }
  } catch (error: any) {
    console.error('Erro na operação de estorno contábil:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
