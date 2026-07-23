import { getClient } from '@/lib/supabase/server'
import { TaxAssessment, TaxAssessmentLine, TaxAssessmentLinesSummary } from './types'

async function getDb() {
  return getClient()
}

export async function listTaxAssessments(companyId: string, filters: { status?: string; taxType?: string } = {}): Promise<TaxAssessment[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')

  const db = await getDb()
  let query = db.from('tax_assessments').select('*, journal_entry:journal_entries(number, status)').eq('company_id', companyId)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.taxType) query = query.eq('tax_type', filters.taxType)

  const { data, error } = await query.order('competence', { ascending: false })
  if (error) throw new Error(error.message || 'Falha ao buscar apurações fiscais.')

  return (data || []) as unknown as TaxAssessment[]
}

// Agrupa as linhas de uma apuração por tipo/origem para a UI (Etapa 24): totais de
// débito/crédito/retenção/ajustes e a separação entre linhas automáticas (geradas de
// documentos/retenções por calculateTaxAssessmentAction) e manuais (lançadas à mão,
// source_type='MANUAL_ADJUSTMENT') — a mesma separação usada pelas actions para decidir o
// que pode ser editado/removido.
export function summarizeTaxAssessmentLines(lines: TaxAssessmentLine[]): TaxAssessmentLinesSummary {
  const summary: TaxAssessmentLinesSummary = {
    debitTotal: 0,
    creditTotal: 0,
    retentionTotal: 0,
    adjustmentPositiveTotal: 0,
    adjustmentNegativeTotal: 0,
    automaticLines: [],
    manualLines: []
  }

  ;(lines || []).forEach((l) => {
    const amt = typeof l.amount === 'string' ? parseFloat(l.amount) : (l.amount || 0)
    if (l.line_type === 'DEBIT') summary.debitTotal += amt
    else if (l.line_type === 'CREDIT') summary.creditTotal += amt
    else if (l.line_type === 'RETENTION') summary.retentionTotal += amt
    else if (l.line_type === 'ADJUSTMENT_POSITIVE') summary.adjustmentPositiveTotal += amt
    else if (l.line_type === 'ADJUSTMENT_NEGATIVE') summary.adjustmentNegativeTotal += amt

    if (l.source_type === 'MANUAL_ADJUSTMENT') summary.manualLines.push(l)
    else summary.automaticLines.push(l)
  })

  return summary
}

export async function getTaxAssessmentById(id: string, companyId: string): Promise<TaxAssessment | null> {
  if (!id || !companyId) throw new Error('ID de apuração e empresa ativa são obrigatórios.')

  const db = await getDb()
  const { data: assessment, error } = await db
    .from('tax_assessments')
    .select('*, journal_entry:journal_entries(number, status)')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Falha ao buscar a apuração fiscal.')
  if (!assessment) return null

  const { data: lines } = await db.from('tax_assessment_lines').select('*').eq('tax_assessment_id', id).eq('company_id', companyId).order('created_at', { ascending: true })
  const linesTyped = (lines || []) as unknown as TaxAssessmentLine[]

  let adjustments: any[] = []
  if (assessment.tax_type === 'IRPJ' || assessment.tax_type === 'CSLL') {
    const { data: adjustmentsData } = await db.from('tax_assessment_adjustments').select('*').eq('assessment_id', id).eq('company_id', companyId).order('created_at', { ascending: true })
    adjustments = adjustmentsData || []
  }

  return { ...(assessment as any), lines: linesTyped, linesSummary: summarizeTaxAssessmentLines(linesTyped), adjustments } as TaxAssessment
}
