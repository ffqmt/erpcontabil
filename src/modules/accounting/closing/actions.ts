'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { closeIncomeStatementSchema } from './validations'
import { getClosingStatus, getClosingPreview } from './queries'
import { ActionResult } from '@/modules/accounting/journal/actions'

/**
 * Retorna o último dia do mês da competência ativa (ex: '2025-01-31' para '2025-01-01').
 */
function getLastDayOfCompetence(competence: string): string {
  const parts = competence.split('-')
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const lastDay = new Date(year, month, 0).getDate()
  const monthStr = month < 10 ? `0${month}` : `${month}`
  return `${year}-${monthStr}-${lastDay}`
}

/**
 * Server Action que efetua o encerramento de resultado da competência ativa.
 */
export async function closeIncomeStatementAction(
  rawInput: unknown
): Promise<ActionResult<{ id: string; number: string | number }>> {
  const context = await getCurrentContext()

  // 1. Validar permissão (Stub, retorna true para MVP)
  // TODO: Integrar futuramente ao sistema de RLS/SSO do Francoos
  const canClose = true
  if (!canClose) {
    return { ok: false, error: 'Acesso negado: permissões de encerramento insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }
  }

  // 2. Validar entrada com Zod
  const validation = closeIncomeStatementSchema.safeParse(rawInput)
  if (!validation.success) {
    return {
      ok: false,
      error: 'Erros de validação nos campos de confirmação.',
      code: 'VALIDATION_ERROR',
      fieldErrors: validation.error.flatten().fieldErrors
    }
  }

  const { equityResultAccountId } = validation.data
  const competenceStart = `${context.competence.substring(0, 7)}-01`

  const db = await getClient()

  try {
    // 4. Buscar status da competência e rascunhos
    const status = await getClosingStatus(context.companyId, context.competence)

    if (status.periodStatus !== 'OPEN' && status.periodStatus !== 'REOPENED') {
      return {
        ok: false,
        error: `O período contábil encontra-se travado (${status.periodStatus}). Operações bloqueadas.`,
        code: 'PERIOD_CLOSED'
      }
    }

    if (status.hasDrafts) {
      return {
        ok: false,
        error: `Não é possível encerrar o resultado: Existem ${status.draftsCount} lançamento(s) em Rascunho (DRAFT) pendente(s) na competência.`,
        code: 'DRAFTS_PENDING'
      }
    }

    if (status.hasClosing) {
      return {
        ok: false,
        error: 'Esta competência contábil já possui um lançamento de encerramento de resultado publicado.',
        code: 'ALREADY_CLOSED'
      }
    }

    // 5. Validar conta contábil destino de PL selecionada
    const { data: equityAcc } = await db
      .from('chart_accounts')
      .select('id, code, name, account_type, is_synthetic, is_active')
      .eq('id', equityResultAccountId)
      .eq('company_id', context.companyId)
      .single()

    if (!equityAcc) {
      return { ok: false, error: 'A conta de destino do PL informada não existe ou pertence a outra empresa.', code: 'INVALID_ACCOUNT' }
    }

    if (equityAcc.account_type !== 'EQUITY' || equityAcc.is_synthetic || !equityAcc.is_active) {
      return { ok: false, error: 'A conta de destino de PL deve ser analítica, ativa e pertencer ao Patrimônio Líquido.', code: 'INVALID_ACCOUNT' }
    }

    // 6. Buscar prévia do encerramento (calcula as somas de zeramento por conta)
    const preview = await getClosingPreview(context.companyId, context.competence, equityResultAccountId)
    
    if (preview.items.length === 0) {
      return { ok: false, error: 'Não há contas de resultado com saldo movimentado nesta competência para serem encerradas.', code: 'NO_BALANCE_TO_CLOSE' }
    }

    // 7. Montar linhas do lançamento de encerramento em centavos
    const entryLinesToInsert: {
      account_id: string
      debit_credit: 'DEBIT' | 'CREDIT'
      amount: number
      memo: string
    }[] = []

    let totalDebitsCents = 0
    let totalCreditsCents = 0

    preview.items.forEach((item) => {
      // Se signedAmount > 0 (Devedor), zera lançando CRÉDITO na conta de resultado
      // Se signedAmount < 0 (Credor), zera lançando DÉBITO na conta de resultado
      const amountCents = Math.round(Math.abs(item.signedAmount) * 100)
      if (amountCents <= 0) return

      const isDebitZero = item.signedAmount < 0 // Credores precisam de Débito para zerar
      const side = isDebitZero ? 'DEBIT' : 'CREDIT'

      if (side === 'DEBIT') {
        totalDebitsCents += amountCents
      } else {
        totalCreditsCents += amountCents
      }

      entryLinesToInsert.push({
        account_id: item.id,
        debit_credit: side,
        amount: amountCents / 100,
        memo: `Zeramento de saldo da conta ${item.code} (${item.name})`
      })
    })

    // Contrapartida líquida no PL
    const netResultCents = Math.round(preview.netResult * 100)
    if (Math.abs(netResultCents) > 0.009) {
      const isLucro = netResultCents > 0
      // Lucro: Crédito no PL (Patrimônio Líquido aumenta)
      // Prejuízo: Débito no PL (Patrimônio Líquido diminui)
      const sidePL = isLucro ? 'CREDIT' : 'DEBIT'
      const amtPL = Math.abs(netResultCents)

      if (sidePL === 'DEBIT') {
        totalDebitsCents += amtPL
      } else {
        totalCreditsCents += amtPL
      }

      entryLinesToInsert.push({
        account_id: equityResultAccountId,
        debit_credit: sidePL,
        amount: amtPL / 100,
        memo: isLucro 
          ? `Transferência líquida de Lucro do Período (${context.competence.substring(5, 7)}/${context.competence.substring(0, 4)})`
          : `Transferência líquida de Prejuízo do Período (${context.competence.substring(5, 7)}/${context.competence.substring(0, 4)})`
      })
    }

    // 8. Validar igualdade matemática (Débitos == Créditos)
    const differenceCents = Math.abs(totalDebitsCents - totalCreditsCents)
    if (differenceCents > 0.009) {
      return {
        ok: false,
        error: `O lançamento de encerramento está desequilibrado por ${differenceCents / 100} BRL. Verifique os saldos.`,
        code: 'UNBALANCED_ENTRY'
      }
    }

    // 9. Data do Lançamento: Último dia da competência
    const lastDayStr = getLastDayOfCompetence(context.competence)

    // 10. Insere a Journal Entry em status DRAFT (Rascunho)
    const { data: newEntry, error: insertError } = await db
      .from('journal_entries')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        entry_date: lastDayStr,
        competence: competenceStart,
        description: `Encerramento de resultado da competência ${context.competence.substring(5, 7)}/${context.competence.substring(0, 4)}`,
        origin: 'RESULT_CLOSING',
        status: 'DRAFT'
      })
      .select('id')
      .single()

    if (insertError || !newEntry) {
      return { ok: false, error: 'Falha ao salvar cabeçalho do lançamento de encerramento.', code: 'DATABASE_ERROR' }
    }

    const entryId = newEntry.id

    // 11. Insere as linhas vinculadas
    const linesToInsert = entryLinesToInsert.map(line => ({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      journal_entry_id: entryId,
      account_id: line.account_id,
      debit_credit: line.debit_credit,
      amount: line.amount,
      memo: line.memo
    }))

    const { error: linesError } = await db
      .from('journal_entry_lines')
      .insert(linesToInsert)

    if (linesError) {
      console.error('Erro ao salvar linhas do lançamento de encerramento:', linesError)
      // Exclui o cabeçalho se as linhas falharem (Rollback manual simulado)
      const { error: rollbackError } = await db.from('journal_entries').delete().eq('id', entryId)
      if (rollbackError) {
        console.error('Falha ao reverter cabeçalho de encerramento após erro nas linhas — rascunho órfão pode ter ficado:', rollbackError)
      }
      return { ok: false, error: `Falha ao salvar as linhas contábeis de zeramento: ${linesError.message}`, code: 'DATABASE_ERROR' }
    }

    // 12. Publicar/Efetivar o lançamento para status POSTED (Ativa trigger de numeração oficial)
    const { data: postedEntry, error: postError } = await db
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', entryId)
      .select('id, number')
      .single()

    if (postError || !postedEntry) {
      // Exclui em cascata caso falte balanceamento na trigger ou erro de banco
      await db.from('journal_entries').delete().eq('id', entryId)
      return { 
        ok: false, 
        error: postError?.message || 'Falha ao publicar lançamento: O banco detectou desequilíbrio contábil nas pernas.', 
        code: 'UNBALANCED_ENTRY' 
      }
    }

    // 13. Revalida todas as visualizações do ERP Contábil
    revalidatePath('/contabilidade/encerramento')
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')
    revalidatePath('/contabilidade/dre')
    revalidatePath('/contabilidade/balanco')

    return {
      ok: true,
      message: `Encerramento de resultado realizado com sucesso! Lançamento Nº ${postedEntry.number} integrado ao livro diário.`,
      data: {
        id: postedEntry.id,
        number: postedEntry.number
      }
    }
  } catch (err: any) {
    console.error('Erro geral na Server Action de encerramento:', err)
    return { ok: false, error: err.message || 'Erro interno do servidor.', code: 'INTERNAL_ERROR' }
  }
}
