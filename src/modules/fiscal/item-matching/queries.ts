import { getClient } from '@/lib/supabase/server'
import { FiscalDocumentItemReviewIssue } from './types'

const OPEN_REVIEW_ISSUES_LIMIT = 100

export async function listOpenReviewIssues(companyId: string): Promise<FiscalDocumentItemReviewIssue[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')

  const db = await getClient()
  const { data, error } = await db
    .from('fiscal_document_item_review_issues')
    .select(`
      id, company_id, fiscal_document_id, fiscal_document_item_id, issue_type,
      severity, status, suggested_item_id, details, created_at, resolved_at,
      fiscal_document:fiscal_documents(id, number, partner:partners(id, name)),
      fiscal_document_item:fiscal_document_items(id, description, ncm, unit, total_amount)
    `)
    .eq('company_id', companyId)
    .eq('status', 'OPEN')
    .order('created_at', { ascending: true })
    .limit(OPEN_REVIEW_ISSUES_LIMIT)

  if (error) throw new Error(error.message || 'Falha ao buscar pendências de classificação de item.')

  return (data || []).map((row: any) => ({
    ...row,
    partner: row.fiscal_document?.partner || null
  })) as FiscalDocumentItemReviewIssue[]
}

export async function countOpenReviewIssues(companyId: string): Promise<number> {
  if (!companyId) return 0

  const db = await getClient()
  const { count, error } = await db
    .from('fiscal_document_item_review_issues')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'OPEN')

  if (error) throw new Error(error.message || 'Falha ao contar pendências de classificação de item.')
  return count || 0
}
