import { getClient } from '@/lib/supabase/server'
import { FiscalImportClassificationRule } from './types'

async function getDb() {
  return getClient()
}

const RULE_SELECT = `
  *,
  partner:partners(id, name),
  fiscal_operation_nature:fiscal_operation_natures(id, code, name)
`

const RULE_LIST_LIMIT = 200
const RULE_ENGINE_LIMIT = 500

export async function listImportClassificationRules(companyId: string): Promise<FiscalImportClassificationRule[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')

  const db = await getDb()
  const { data, error } = await db
    .from('fiscal_import_classification_rules')
    .select(RULE_SELECT)
    .eq('company_id', companyId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(RULE_LIST_LIMIT)

  if (error) throw new Error(error.message || 'Falha ao buscar regras de importação XML.')
  return (data || []) as unknown as FiscalImportClassificationRule[]
}

export async function getImportClassificationRuleById(id: string, companyId: string): Promise<FiscalImportClassificationRule | null> {
  if (!id || !companyId) throw new Error('ID de regra e empresa ativa são obrigatórios.')

  const db = await getDb()
  const { data, error } = await db
    .from('fiscal_import_classification_rules')
    .select(RULE_SELECT)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Falha ao buscar a regra de importação XML.')
  return data as unknown as FiscalImportClassificationRule | null
}

/**
 * Usada internamente pela gravação da importação de XML (writeFiscalDocumentFromImport) —
 * aceita o client já aberto pela action chamadora em vez de abrir um novo, mesmo padrão de
 * outras funções internas deste módulo fiscal (ex.: generateAutomaticLines).
 */
export async function listActiveImportClassificationRulesForEngine(db: any, companyId: string): Promise<FiscalImportClassificationRule[]> {
  const { data, error } = await db
    .from('fiscal_import_classification_rules')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('priority', { ascending: true })
    .limit(RULE_ENGINE_LIMIT)

  if (error) throw error
  return (data || []) as FiscalImportClassificationRule[]
}
