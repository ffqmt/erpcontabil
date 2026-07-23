import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getJournalEntries } from '@/modules/accounting/journal/queries'
import { JournalList } from '@/modules/accounting/journal/components/journal-list'
import { JournalEntry } from '@/modules/accounting/journal/types'
import { formatCompetenceBR } from '@/modules/accounting/journal/journal-utils'
import { PrintButton } from '@/components/reports/print-button'
import { ExportCsvButton } from '@/components/reports/export-csv-button'
import { ReportHeader } from '@/components/reports/report-header'
import { ReportFooter } from '@/components/reports/report-footer'
import { mapJournalToCsvRows, JOURNAL_CSV_HEADERS } from '@/modules/accounting/journal/export'
import { getClient } from '@/lib/supabase/server'
import { AlertCircle, BookOpen } from 'lucide-react'

export const dynamic = 'force-dynamic'

function getSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export default async function DiarioPage() {
  const context = await getCurrentContext()
  
  const competenceDate = new Date(context.competence + 'T00:00:00')
  const lastDay = new Date(competenceDate.getFullYear(), competenceDate.getMonth() + 1, 0)
  const startDate = context.competence
  const endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

  let entries: JournalEntry[] = []
  let errorMsg = null
  let companySlug = 'empresa'

  try {
    // 1. Busca lançamentos
    entries = await getJournalEntries(context.companyId, context.competence)
    
    // 2. Busca nome da empresa para o nome do arquivo de exportação
    const db = await getClient()
    const { data: comp } = await db
      .from('companies')
      .select('trade_name, legal_name')
      .eq('id', context.companyId)
      .single()
      
    if (comp) {
      companySlug = getSlug(comp.trade_name || comp.legal_name)
    }
  } catch (error: any) {
    errorMsg = error.message || 'Erro desconhecido ao carregar o Livro Diário.'
  }

  // Prepara dados de CSV
  const csvRows = mapJournalToCsvRows(entries)
  const competenceYearMonth = context.competence.substring(0, 7) // YYYY-MM
  const csvFilename = `diario_${companySlug}_${competenceYearMonth}.csv`

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-50 text-violet-700 rounded-lg border border-violet-100">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Livro Diário</h2>
            <p className="text-sm text-gray-500">Listagem cronológica oficial de lançamentos contábeis publicados.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 font-medium w-fit">
            Período Contábil: <span className="text-gray-700 font-bold">{formatCompetenceBR(context.competence)}</span>
          </div>
          <div className="flex items-center gap-2">
            <ExportCsvButton filename={csvFilename} rows={csvRows} headers={JOURNAL_CSV_HEADERS} />
            <PrintButton />
          </div>
        </div>
      </div>

      {/* Trata Estado de Erro */}
      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 space-y-4 max-w-2xl">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
            <div>
              <strong className="font-semibold block mb-1">Falha ao Conectar ao Banco de Dados</strong>
              <p className="text-sm leading-relaxed text-red-700">{errorMsg}</p>
            </div>
          </div>
        </div>
      ) : entries.length === 0 ? (
        /* Trata Estado Vazio (Empty State) */
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-2xl text-amber-900 space-y-4">
          <div className="flex gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0 text-amber-600" />
            <div>
              <strong className="font-semibold text-base block mb-1">Nenhum Lançamento Publicado Encontrado</strong>
              <p className="text-sm leading-relaxed text-amber-800">
                A empresa ativa ({context.companyId}) não possui lançamentos com status **POSTED** na competência **{formatCompetenceBR(context.competence)}**.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Renderiza Lista do Diário timbrado para impressão */
        <div className="space-y-4">
          {/* Cabeçalho formal visível na impressão */}
          <ReportHeader
            companyId={context.companyId}
            title="LIVRO DIÁRIO CONTÁBIL"
            startDate={startDate}
            endDate={endDate}
          />
          
          <JournalList entries={entries} />

          {/* Rodapé formal visível na impressão */}
          <ReportFooter companyId={context.companyId} endDate={endDate} />
        </div>
      )}
    </div>
  )
}
