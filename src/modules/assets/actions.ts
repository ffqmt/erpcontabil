'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClient } from '@/lib/supabase/server'
import { canManageAssets, canGenerateAssetDepreciation, canPostFiscalToAccounting } from '@/lib/permissions/permissions'
import {
  createAssetCategorySchema,
  updateAssetCategorySchema,
  toggleAssetCategoryActiveSchema,
  createFixedAssetSchema,
  updateFixedAssetSchema,
  fixedAssetIdSchema,
  disposeFixedAssetSchema,
  generateAssetDepreciationsSchema,
  postAssetDepreciationSchema,
  createFixedAssetFromFiscalItemSchema
} from './validations'
import { calculateMonthlyDepreciation } from './utils'

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> }

async function getDb() {
  return getClient()
}

function revalidateAssets(id?: string) {
  revalidatePath('/patrimonio')
  revalidatePath('/patrimonio/bens')
  revalidatePath('/patrimonio/categorias')
  revalidatePath('/patrimonio/depreciacoes')
  if (id) revalidatePath(`/patrimonio/bens/${id}`)
}

// =====================================================================================
// CATEGORIAS
// =====================================================================================

function categoryRow(input: any) {
  return {
    name: input.name,
    description: input.description || null,
    default_useful_life_months: input.defaultUsefulLifeMonths,
    default_annual_rate: input.defaultAnnualRate ?? null,
    default_asset_account_id: input.defaultAssetAccountId || null,
    default_depreciation_account_id: input.defaultDepreciationAccountId || null,
    default_expense_account_id: input.defaultExpenseAccountId || null,
    disposal_gain_account_id: input.disposalGainAccountId || null,
    disposal_loss_account_id: input.disposalLossAccountId || null
  }
}

function roundCurrency(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100
}

export async function createAssetCategoryAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageAssets())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = createAssetCategorySchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }

  const context = await getCurrentContext()
  const db = await getDb()

  try {
    const accountIds = [
      validation.data.defaultAssetAccountId,
      validation.data.defaultDepreciationAccountId,
      validation.data.defaultExpenseAccountId,
      validation.data.disposalGainAccountId,
      validation.data.disposalLossAccountId
    ].filter(Boolean) as string[]
    for (const accountId of accountIds) {
      const err = await assertAccountValid(db, accountId, context.companyId)
      if (err) return { ok: false, error: err, code: 'INVALID_ACCOUNT' }
    }

    const { data, error } = await db.from('asset_categories').insert({ workspace_id: context.workspaceId, company_id: context.companyId, active: true, ...categoryRow(validation.data) }).select('id').single()
    if (error || !data) throw error || new Error('Falha ao criar categoria patrimonial.')

    revalidateAssets()
    return { ok: true, data: { id: data.id }, message: 'Categoria patrimonial criada.' }
  } catch (error: any) {
    console.error('Erro ao criar categoria patrimonial:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateAssetCategoryAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageAssets())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = updateAssetCategorySchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...fields } = validation.data

  try {
    const accountIds = [
      fields.defaultAssetAccountId,
      fields.defaultDepreciationAccountId,
      fields.defaultExpenseAccountId,
      fields.disposalGainAccountId,
      fields.disposalLossAccountId
    ].filter(Boolean) as string[]
    for (const accountId of accountIds) {
      const err = await assertAccountValid(db, accountId, context.companyId)
      if (err) return { ok: false, error: err, code: 'INVALID_ACCOUNT' }
    }

    const { error } = await db.from('asset_categories').update(categoryRow(fields)).eq('id', id).eq('company_id', context.companyId)
    if (error) throw error

    revalidateAssets()
    return { ok: true, data: { id }, message: 'Categoria patrimonial atualizada.' }
  } catch (error: any) {
    console.error('Erro ao atualizar categoria patrimonial:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function toggleAssetCategoryActiveAction(rawInput: unknown): Promise<ActionResult<{ id: string; active: boolean }>> {
  if (!(await canManageAssets())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = toggleAssetCategoryActiveSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, active } = validation.data

  try {
    const { data, error } = await db.from('asset_categories').update({ active }).eq('id', id).eq('company_id', context.companyId).select('id, active').single()
    if (error || !data) throw error || new Error('Falha ao alterar status da categoria.')

    revalidateAssets()
    return { ok: true, data: { id: data.id, active: data.active }, message: data.active ? 'Categoria reativada.' : 'Categoria inativada.' }
  } catch (error: any) {
    console.error('Erro ao alterar status da categoria patrimonial:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// BENS PATRIMONIAIS
// =====================================================================================

function assetRow(input: any) {
  return {
    category_id: input.categoryId,
    code: input.code || null,
    description: input.description,
    asset_tag: input.assetTag || null,
    acquisition_date: input.acquisitionDate,
    start_depreciation_date: input.startDepreciationDate || null,
    acquisition_amount: input.acquisitionAmount,
    residual_amount: input.residualAmount,
    useful_life_months: input.usefulLifeMonths,
    fiscal_document_id: input.fiscalDocumentId || null,
    partner_id: input.partnerId || null,
    asset_account_id: input.assetAccountId,
    depreciation_account_id: input.depreciationAccountId,
    expense_account_id: input.expenseAccountId,
    cost_center_id: input.costCenterId || null
  }
}

async function assertAccountValid(db: any, accountId: string, companyId: string) {
  const { data: acc } = await db.from('chart_accounts').select('id, company_id, is_active, is_synthetic, accepts_entries').eq('id', accountId).single()
  if (!acc || acc.company_id !== companyId) return 'Uma das contas selecionadas não existe ou pertence a outra empresa.'
  if (!acc.is_active || acc.is_synthetic || !acc.accepts_entries) return 'As contas selecionadas devem ser analíticas, ativas e aceitar lançamentos.'
  return null
}

export async function createFixedAssetAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageAssets())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = createFixedAssetSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }

  const context = await getCurrentContext()
  const db = await getDb()
  const input = validation.data

  try {
    for (const accountId of [input.assetAccountId, input.depreciationAccountId, input.expenseAccountId]) {
      const err = await assertAccountValid(db, accountId, context.companyId)
      if (err) return { ok: false, error: err, code: 'INVALID_ACCOUNT' }
    }

    const { data: category } = await db.from('asset_categories').select('id, company_id').eq('id', input.categoryId).single()
    if (!category || category.company_id !== context.companyId) {
      return { ok: false, error: 'A categoria informada não existe ou pertence a outra empresa.', code: 'INVALID_CATEGORY' }
    }

    const { data, error } = await db
      .from('fixed_assets')
      .insert({ workspace_id: context.workspaceId, company_id: context.companyId, status: 'ACTIVE', ...assetRow(input) })
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '23505') return { ok: false, error: 'Já existe um bem com este código nesta empresa.', code: 'DUPLICATE_CODE' }
      throw error || new Error('Falha ao criar bem patrimonial.')
    }

    await db.from('asset_events').insert({ workspace_id: context.workspaceId, company_id: context.companyId, fixed_asset_id: data.id, event_type: 'ACQUISITION', event_date: input.acquisitionDate, amount: input.acquisitionAmount, notes: 'Aquisição registrada no cadastro do bem.' })

    revalidateAssets()
    return { ok: true, data: { id: data.id }, message: 'Bem patrimonial criado.' }
  } catch (error: any) {
    console.error('Erro ao criar bem patrimonial:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

/**
 * Etapa 33A — cria um bem patrimonial diretamente a partir de um item de documento fiscal
 * classificado como ASSET. Descrição, valor de aquisição, data e parceiro vêm do
 * item/documento (nunca do client); as 3 contas contábeis e a vida útil/valor residual
 * default vêm da categoria escolhida. Nunca cria 2 bens para o mesmo item (índice único
 * em fixed_assets.fiscal_document_item_id, mais checagem explícita aqui para mensagem
 * amigável).
 */
export async function createFixedAssetFromFiscalItemAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageAssets())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = createFixedAssetFromFiscalItemSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }

  const context = await getCurrentContext()
  const db = await getDb()
  const { fiscalDocumentItemId, categoryId, code, assetTag, usefulLifeMonths, residualAmount, costCenterId } = validation.data

  try {
    const { data: item } = await db
      .from('fiscal_document_items')
      .select('id, company_id, description, total_amount, item_type, fiscal_document_id')
      .eq('id', fiscalDocumentItemId)
      .eq('company_id', context.companyId)
      .single()
    if (!item) return { ok: false, error: 'Item fiscal não encontrado ou pertence a outra empresa.', code: 'NOT_FOUND' }
    if (item.item_type !== 'ASSET') {
      return { ok: false, error: 'Este item não está classificado como Ativo Imobilizado — altere o tipo do item antes de criar o bem.', code: 'INVALID_ITEM_TYPE' }
    }

    const { count } = await db.from('fixed_assets').select('id', { count: 'exact', head: true }).eq('fiscal_document_item_id', fiscalDocumentItemId).eq('company_id', context.companyId)
    if (count && count > 0) {
      return { ok: false, error: 'Já existe um bem patrimonial criado a partir deste item.', code: 'ALREADY_LINKED' }
    }

    const { data: doc } = await db
      .from('fiscal_documents')
      .select('id, company_id, partner_id, operation_date, issue_date')
      .eq('id', item.fiscal_document_id)
      .eq('company_id', context.companyId)
      .single()
    if (!doc) return { ok: false, error: 'Documento fiscal de origem não encontrado.', code: 'NOT_FOUND' }

    const { data: category } = await db.from('asset_categories').select('*').eq('id', categoryId).eq('company_id', context.companyId).single()
    if (!category) return { ok: false, error: 'A categoria informada não existe ou pertence a outra empresa.', code: 'INVALID_CATEGORY' }
    if (!category.default_asset_account_id || !category.default_depreciation_account_id || !category.default_expense_account_id) {
      return {
        ok: false,
        error: `A categoria "${category.name}" não tem as 3 contas contábeis padrão configuradas (ativo, depreciação acumulada, despesa) — configure-as em Patrimônio > Categorias antes de criar bens a partir dela.`,
        code: 'CATEGORY_MISSING_ACCOUNTS'
      }
    }

    const acquisitionDate = doc.operation_date || doc.issue_date
    const acquisitionAmount = Number(item.total_amount)
    const finalResidual = residualAmount ?? 0
    if (finalResidual >= acquisitionAmount) {
      return { ok: false, error: 'O valor residual deve ser menor que o valor de aquisição (valor do item).', code: 'INVALID_RESIDUAL' }
    }

    const { data: newAsset, error } = await db
      .from('fixed_assets')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        category_id: categoryId,
        code: code || null,
        description: item.description,
        asset_tag: assetTag || null,
        acquisition_date: acquisitionDate,
        acquisition_amount: acquisitionAmount,
        residual_amount: finalResidual,
        useful_life_months: usefulLifeMonths ?? category.default_useful_life_months,
        fiscal_document_id: doc.id,
        fiscal_document_item_id: item.id,
        partner_id: doc.partner_id,
        asset_account_id: category.default_asset_account_id,
        depreciation_account_id: category.default_depreciation_account_id,
        expense_account_id: category.default_expense_account_id,
        cost_center_id: costCenterId || null,
        status: 'ACTIVE'
      })
      .select('id')
      .single()

    if (error || !newAsset) {
      if (error?.code === '23505') return { ok: false, error: 'Já existe um bem criado a partir deste item ou com este código.', code: 'DUPLICATE_CODE' }
      throw error || new Error('Falha ao criar bem patrimonial a partir do item fiscal.')
    }

    await db.from('asset_events').insert({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      fixed_asset_id: newAsset.id,
      event_type: 'ACQUISITION',
      event_date: acquisitionDate,
      amount: acquisitionAmount,
      notes: `Aquisição via item do documento fiscal ${doc.id}.`
    })

    revalidateAssets(newAsset.id)
    revalidatePath(`/fiscal/documentos/${doc.id}`)
    return { ok: true, data: { id: newAsset.id }, message: 'Bem patrimonial criado a partir do item fiscal!' }
  } catch (error: any) {
    console.error('Erro ao criar bem patrimonial a partir do item fiscal:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function updateFixedAssetAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await canManageAssets())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = updateFixedAssetSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, ...fields } = validation.data

  try {
    const { data: existing } = await db.from('fixed_assets').select('status, acquisition_amount, residual_amount, useful_life_months, start_depreciation_date, acquisition_date').eq('id', id).eq('company_id', context.companyId).single()
    if (!existing) return { ok: false, error: 'Bem patrimonial não encontrado.', code: 'NOT_FOUND' }
    if (existing.status === 'DISPOSED' || existing.status === 'SOLD') {
      return { ok: false, error: `Bem ${existing.status} não pode ser editado.`, code: 'INVALID_STATUS' }
    }

    const { count: depreciationCount } = await db.from('asset_depreciations').select('id', { count: 'exact', head: true }).eq('fixed_asset_id', id).neq('status', 'CANCELLED')
    if (depreciationCount && depreciationCount > 0) {
      const acquisitionChanged = Number(existing.acquisition_amount) !== Number(fields.acquisitionAmount)
      const residualChanged = Number(existing.residual_amount) !== Number(fields.residualAmount)
      const lifeChanged = Number(existing.useful_life_months) !== Number(fields.usefulLifeMonths)
      const startChanged = (existing.start_depreciation_date || existing.acquisition_date) !== (fields.startDepreciationDate || fields.acquisitionDate)
      if (acquisitionChanged || residualChanged || lifeChanged || startChanged) {
        return {
          ok: false,
          error: 'Este bem já possui depreciação lançada — não é possível alterar valor de aquisição, valor residual, vida útil ou data de início da depreciação (mudaria o cálculo retroativamente). Dê baixa e cadastre um novo bem, se necessário.',
          code: 'HAS_DEPRECIATIONS'
        }
      }
    }

    for (const accountId of [fields.assetAccountId, fields.depreciationAccountId, fields.expenseAccountId]) {
      const err = await assertAccountValid(db, accountId, context.companyId)
      if (err) return { ok: false, error: err, code: 'INVALID_ACCOUNT' }
    }

    const { error } = await db.from('fixed_assets').update(assetRow(fields)).eq('id', id).eq('company_id', context.companyId)
    if (error) throw error

    revalidateAssets(id)
    return { ok: true, data: { id }, message: 'Bem patrimonial atualizado.' }
  } catch (error: any) {
    console.error('Erro ao atualizar bem patrimonial:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function disposeFixedAssetAction(rawInput: unknown): Promise<ActionResult<{ id: string; journalEntryId: string; journalEntryNumber: number | null }>> {
  if (!(await canManageAssets())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = disposeFixedAssetSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Erros de validação.', code: 'VALIDATION_ERROR', fieldErrors: validation.error.flatten().fieldErrors }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id, disposalDate, disposalAmount, disposalCounterpartAccountId, disposalReason } = validation.data

  try {
    const { data: existing } = await db
      .from('fixed_assets')
      .select('id, status, code, description, acquisition_date, acquisition_amount, asset_account_id, depreciation_account_id, cost_center_id, disposal_journal_entry_id, category:asset_categories(name, disposal_gain_account_id, disposal_loss_account_id)')
      .eq('id', id)
      .eq('company_id', context.companyId)
      .single()
    if (!existing) return { ok: false, error: 'Bem patrimonial não encontrado.', code: 'NOT_FOUND' }
    if (existing.status === 'DISPOSED' || existing.status === 'SOLD') {
      return { ok: false, error: 'Bem já está baixado.', code: 'ALREADY_DISPOSED' }
    }
    if (existing.disposal_journal_entry_id) {
      return { ok: false, error: 'Este bem já possui lançamento de baixa vinculado.', code: 'ALREADY_ACCOUNTED' }
    }
    if (disposalDate < existing.acquisition_date) {
      return { ok: false, error: 'A data de baixa não pode ser anterior à data de aquisição.', code: 'INVALID_DATE' }
    }

    const disposalProceeds = roundCurrency(disposalAmount ?? 0)
    if (disposalProceeds > 0 && !disposalCounterpartAccountId) {
      return { ok: false, error: 'Informe a conta de entrada/recebível para registrar o valor de venda/baixa.', code: 'COUNTERPART_REQUIRED' }
    }

    const category = Array.isArray(existing.category) ? existing.category[0] : existing.category
    if (!category) {
      return { ok: false, error: 'Categoria patrimonial do bem não encontrada.', code: 'INVALID_CATEGORY' }
    }

    const { data: depreciations } = await db
      .from('asset_depreciations')
      .select('accounting_amount')
      .eq('fixed_asset_id', id)
      .eq('company_id', context.companyId)
      .neq('status', 'CANCELLED')

    const accumulatedRaw = (depreciations || []).reduce((sum: number, dep: any) => sum + Number(dep.accounting_amount || 0), 0)
    const acquisitionAmount = roundCurrency(Number(existing.acquisition_amount || 0))
    const accumulatedDepreciation = roundCurrency(Math.min(accumulatedRaw, acquisitionAmount))
    const netBookValue = roundCurrency(Math.max(0, acquisitionAmount - accumulatedDepreciation))
    const gainAmount = roundCurrency(Math.max(0, disposalProceeds - netBookValue))
    const lossAmount = roundCurrency(Math.max(0, netBookValue - disposalProceeds))

    if (gainAmount > 0 && !category.disposal_gain_account_id) {
      return { ok: false, error: `A categoria "${category.name}" não possui conta de ganho na baixa configurada.`, code: 'CATEGORY_MISSING_GAIN_ACCOUNT' }
    }
    if (lossAmount > 0 && !category.disposal_loss_account_id) {
      return { ok: false, error: `A categoria "${category.name}" não possui conta de perda na baixa configurada.`, code: 'CATEGORY_MISSING_LOSS_ACCOUNT' }
    }

    const accountIds = [
      existing.asset_account_id,
      accumulatedDepreciation > 0 ? existing.depreciation_account_id : null,
      disposalProceeds > 0 ? disposalCounterpartAccountId : null,
      gainAmount > 0 ? category.disposal_gain_account_id : null,
      lossAmount > 0 ? category.disposal_loss_account_id : null
    ].filter(Boolean) as string[]
    for (const accountId of accountIds) {
      const err = await assertAccountValid(db, accountId, context.companyId)
      if (err) return { ok: false, error: err, code: 'INVALID_ACCOUNT' }
    }

    const competence = `${disposalDate.substring(0, 7)}-01`
    const { data: period } = await db.from('accounting_periods').select('status').eq('company_id', context.companyId).eq('competence', competence).single()
    if (!period) return { ok: false, error: `Período contábil para a competência ${competence} não encontrado.`, code: 'PERIOD_NOT_FOUND' }
    if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
      return { ok: false, error: `O período contábil (${competence}) está fechado (${period.status}).`, code: 'PERIOD_CLOSED' }
    }

    const assetLabel = existing.code || existing.description
    const { data: newEntry, error: insertError } = await db
      .from('journal_entries')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        entry_date: disposalDate,
        competence,
        description: `Baixa de bem patrimonial — ${assetLabel}`,
        origin: 'ASSET_DISPOSAL',
        origin_id: id,
        status: 'DRAFT'
      })
      .select('id')
      .single()

    if (insertError || !newEntry) throw insertError || new Error('Falha ao criar cabeçalho do lançamento de baixa.')

    const journalEntryId = newEntry.id
    const lines: any[] = []
    if (accumulatedDepreciation > 0) {
      lines.push({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        journal_entry_id: journalEntryId,
        account_id: existing.depreciation_account_id,
        debit_credit: 'DEBIT',
        amount: accumulatedDepreciation,
        memo: `Baixa da depreciação acumulada — ${assetLabel}`
      })
    }
    if (disposalProceeds > 0) {
      lines.push({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        journal_entry_id: journalEntryId,
        account_id: disposalCounterpartAccountId,
        debit_credit: 'DEBIT',
        amount: disposalProceeds,
        memo: `Valor de venda/baixa — ${assetLabel}`,
        cost_center_id: existing.cost_center_id || null
      })
    }
    if (lossAmount > 0) {
      lines.push({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        journal_entry_id: journalEntryId,
        account_id: category.disposal_loss_account_id,
        debit_credit: 'DEBIT',
        amount: lossAmount,
        memo: `Perda na baixa — ${assetLabel}`,
        cost_center_id: existing.cost_center_id || null
      })
    }
    lines.push({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      journal_entry_id: journalEntryId,
      account_id: existing.asset_account_id,
      debit_credit: 'CREDIT',
      amount: acquisitionAmount,
      memo: `Baixa do custo de aquisição — ${assetLabel}`
    })
    if (gainAmount > 0) {
      lines.push({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        journal_entry_id: journalEntryId,
        account_id: category.disposal_gain_account_id,
        debit_credit: 'CREDIT',
        amount: gainAmount,
        memo: `Ganho na baixa — ${assetLabel}`,
        cost_center_id: existing.cost_center_id || null
      })
    }

    const debitTotal = roundCurrency(lines.filter((line) => line.debit_credit === 'DEBIT').reduce((sum, line) => sum + Number(line.amount), 0))
    const creditTotal = roundCurrency(lines.filter((line) => line.debit_credit === 'CREDIT').reduce((sum, line) => sum + Number(line.amount), 0))
    if (Math.abs(debitTotal - creditTotal) > 0.005) {
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      return { ok: false, error: `Lançamento de baixa desbalanceado (${debitTotal.toFixed(2)} x ${creditTotal.toFixed(2)}).`, code: 'UNBALANCED_ENTRY' }
    }

    const { error: linesError } = await db.from('journal_entry_lines').insert(lines)
    if (linesError) {
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      throw linesError
    }

    const { data: posted, error: postError } = await db.from('journal_entries').update({ status: 'POSTED' }).eq('id', journalEntryId).select('id, number').single()
    if (postError || !posted) {
      await db.from('journal_entries').delete().eq('id', journalEntryId)
      return { ok: false, error: postError?.message || 'O banco rejeitou a publicação do lançamento de baixa.', code: 'UNBALANCED_ENTRY' }
    }

    const finalStatus = disposalProceeds > 0 ? 'SOLD' : 'DISPOSED'
    const { error } = await db
      .from('fixed_assets')
      .update({ status: finalStatus, disposal_date: disposalDate, disposal_amount: disposalAmount ?? null, disposal_reason: disposalReason, disposal_journal_entry_id: journalEntryId })
      .eq('id', id)
      .eq('company_id', context.companyId)

    if (error) throw error

    const { error: eventError } = await db.from('asset_events').insert({
      workspace_id: context.workspaceId,
      company_id: context.companyId,
      fixed_asset_id: id,
      event_type: 'DISPOSAL',
      event_date: disposalDate,
      amount: disposalAmount ?? null,
      journal_entry_id: journalEntryId,
      notes: disposalReason
    })
    if (eventError) throw eventError

    revalidateAssets(id)
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')

    const gainLossText = gainAmount > 0 ? `ganho ${gainAmount.toFixed(2)}` : lossAmount > 0 ? `perda ${lossAmount.toFixed(2)}` : 'sem ganho/perda'
    return {
      ok: true,
      data: { id, journalEntryId, journalEntryNumber: posted.number },
      message: `Bem baixado com lançamento nº ${posted.number} (${gainLossText}).`
    }
  } catch (error: any) {
    console.error('Erro ao baixar bem patrimonial:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

// =====================================================================================
// DEPRECIAÇÃO (Etapa 22.4 + 22.5 — Etapa 21: Patrimônio -> Contabilidade)
// =====================================================================================

export async function generateAssetDepreciationsAction(rawInput: unknown): Promise<ActionResult<{ generated: number; skipped: number }>> {
  if (!(await canGenerateAssetDepreciation())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = generateAssetDepreciationsSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Informe uma competência válida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const competenceStart = `${validation.data.competence.substring(0, 7)}-01`

  try {
    const { data: assets } = await db.from('fixed_assets').select('*').eq('company_id', context.companyId).eq('status', 'ACTIVE')

    let generated = 0
    let skipped = 0

    for (const asset of assets || []) {
      const startDate = asset.start_depreciation_date || asset.acquisition_date
      if (startDate > competenceStart) {
        skipped++
        continue
      }

      const { data: existingDep } = await db.from('asset_depreciations').select('id').eq('fixed_asset_id', asset.id).eq('competence', competenceStart).maybeSingle()
      if (existingDep) {
        skipped++
        continue
      }

      const { data: pastDeps } = await db.from('asset_depreciations').select('accounting_amount').eq('fixed_asset_id', asset.id).neq('status', 'CANCELLED')
      const accumulated = (pastDeps || []).reduce((sum: number, d: any) => sum + (typeof d.accounting_amount === 'string' ? parseFloat(d.accounting_amount) : d.accounting_amount), 0)

      const acquisitionAmount = typeof asset.acquisition_amount === 'string' ? parseFloat(asset.acquisition_amount) : asset.acquisition_amount
      const residualAmount = typeof asset.residual_amount === 'string' ? parseFloat(asset.residual_amount) : asset.residual_amount
      const depreciableValue = acquisitionAmount - residualAmount
      const remaining = depreciableValue - accumulated

      if (remaining <= 0.01) {
        await db.from('fixed_assets').update({ status: 'FULLY_DEPRECIATED' }).eq('id', asset.id)
        skipped++
        continue
      }

      let monthly = calculateMonthlyDepreciation(acquisitionAmount, residualAmount, asset.useful_life_months)
      if (monthly > remaining) monthly = remaining

      const newAccumulated = accumulated + monthly
      const netBookValue = acquisitionAmount - newAccumulated
      const lastDay = new Date(competenceStart)
      lastDay.setMonth(lastDay.getMonth() + 1)
      lastDay.setDate(0)

      await db.from('asset_depreciations').insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        fixed_asset_id: asset.id,
        competence: competenceStart,
        accounting_amount: monthly,
        fiscal_amount: monthly,
        status: 'CALCULATED',
        depreciation_date: lastDay.toISOString().substring(0, 10),
        accumulated_amount_after: newAccumulated,
        net_book_value_after: netBookValue
      })

      if (netBookValue <= residualAmount + 0.01) {
        await db.from('fixed_assets').update({ status: 'FULLY_DEPRECIATED' }).eq('id', asset.id)
      }

      generated++
    }

    revalidateAssets()
    return { ok: true, data: { generated, skipped }, message: `${generated} depreciação(ões) gerada(s), ${skipped} bem(ns) ignorado(s) (já depreciado no mês, totalmente depreciado ou fora do período de início).` }
  } catch (error: any) {
    console.error('Erro ao gerar depreciações patrimoniais:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}

export async function postAssetDepreciationAction(rawInput: unknown): Promise<ActionResult<{ journalEntryId: string; journalEntryNumber: number | null }>> {
  if (!(await canPostFiscalToAccounting())) return { ok: false, error: 'Acesso negado: permissões insuficientes.', code: 'INSUFFICIENT_PERMISSIONS' }

  const validation = postAssetDepreciationSchema.safeParse(rawInput)
  if (!validation.success) return { ok: false, error: 'Requisição inválida.', code: 'VALIDATION_ERROR' }

  const context = await getCurrentContext()
  const db = await getDb()
  const { id } = validation.data

  try {
    const { data: dep } = await db.from('asset_depreciations').select('*, fixed_asset:fixed_assets(*)').eq('id', id).eq('company_id', context.companyId).single()
    if (!dep) return { ok: false, error: 'Depreciação não encontrada.', code: 'NOT_FOUND' }
    if (dep.status !== 'CALCULATED') return { ok: false, error: `Só é possível contabilizar depreciações Calculadas (status atual: ${dep.status}).`, code: 'INVALID_STATUS' }

    const asset = dep.fixed_asset
    if (!asset) return { ok: false, error: 'Bem patrimonial vinculado não encontrado.', code: 'NOT_FOUND' }

    const { data: period } = await db.from('accounting_periods').select('status').eq('company_id', context.companyId).eq('competence', dep.competence).single()
    if (!period) return { ok: false, error: `Período contábil para a competência ${dep.competence} não encontrado.`, code: 'PERIOD_NOT_FOUND' }
    if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
      return { ok: false, error: `O período contábil (${dep.competence}) está fechado (${period.status}).`, code: 'PERIOD_CLOSED' }
    }

    const amount = Number(dep.accounting_amount)
    const entryDate = dep.depreciation_date || dep.competence

    const { data: newEntry, error: insertError } = await db
      .from('journal_entries')
      .insert({
        workspace_id: context.workspaceId,
        company_id: context.companyId,
        entry_date: entryDate,
        competence: dep.competence,
        description: `Depreciação mensal — ${asset.code || asset.description} (competência ${dep.competence.substring(5, 7)}/${dep.competence.substring(0, 4)})`,
        origin: 'ASSET_DEPRECIATION',
        origin_id: dep.fixed_asset_id,
        status: 'DRAFT'
      })
      .select('id')
      .single()

    if (insertError || !newEntry) throw insertError || new Error('Falha ao criar cabeçalho do lançamento.')

    const journalEntryId = newEntry.id
    const { error: linesError } = await db.from('journal_entry_lines').insert([
      { workspace_id: context.workspaceId, company_id: context.companyId, journal_entry_id: journalEntryId, account_id: asset.expense_account_id, debit_credit: 'DEBIT', amount, memo: `Depreciação ${asset.code || asset.description}`, cost_center_id: asset.cost_center_id || null },
      { workspace_id: context.workspaceId, company_id: context.companyId, journal_entry_id: journalEntryId, account_id: asset.depreciation_account_id, debit_credit: 'CREDIT', amount, memo: `Depreciação acumulada ${asset.code || asset.description}` }
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

    await db.from('asset_depreciations').update({ status: 'POSTED', journal_entry_id: journalEntryId }).eq('id', id).eq('company_id', context.companyId)

    revalidateAssets(dep.fixed_asset_id)
    revalidatePath('/contabilidade/lancamentos')
    revalidatePath('/contabilidade/diario')
    revalidatePath('/contabilidade/balancete')

    return { ok: true, data: { journalEntryId, journalEntryNumber: posted.number }, message: `Lançamento nº ${posted.number} gerado — depreciação contabilizada!` }
  } catch (error: any) {
    console.error('Erro ao contabilizar depreciação patrimonial:', error)
    return { ok: false, error: error.message || 'Falha de comunicação com o Supabase.', code: 'DATABASE_ERROR' }
  }
}
