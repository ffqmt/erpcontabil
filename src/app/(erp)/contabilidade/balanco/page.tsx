import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getBalanceSheetRawData } from '@/modules/accounting/balance-sheet/queries'
import { calculateBalanceSheet } from '@/modules/accounting/balance-sheet/balance-sheet-calculator'
import { BalanceSheetTable } from '@/modules/accounting/balance-sheet/components/balance-sheet-table'
import { formatCompetenceBR } from '@/modules/accounting/balance-sheet/balance-sheet-utils'
import { PrintButton } from '@/components/reports/print-button'
import { ExportCsvButton } from '@/components/reports/export-csv-button'
import { ReportHeader } from '@/components/reports/report-header'
import { ReportFooter } from '@/components/reports/report-footer'
import { ReportDateFilter } from '@/components/reports/report-date-filter'
import { mapBalanceSheetToCsvRows, BALANCE_SHEET_CSV_HEADERS } from '@/modules/accounting/balance-sheet/export'
import { getClient } from '@/lib/supabase/server'
import { AlertCircle, Scale, HelpCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

function getSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function BalancoPage({ searchParams }: PageProps) {
  const context = await getCurrentContext()
  const resolvedSearchParams = await searchParams

  // Calcula valores de período padrão baseados na competência
  const competenceDate = new Date(context.competence + 'T00:00:00')
  const lastDay = new Date(competenceDate.getFullYear(), competenceDate.getMonth() + 1, 0)
  const defaultStartDate = context.competence
  const defaultEndDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

  const startDate = typeof resolvedSearchParams.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(resolvedSearchParams.startDate)
    ? resolvedSearchParams.startDate
    : defaultStartDate

  const endDate = typeof resolvedSearchParams.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(resolvedSearchParams.endDate)
    ? resolvedSearchParams.endDate
    : defaultEndDate

  let actualStartDate = startDate
  let actualEndDate = endDate
  if (new Date(startDate) > new Date(endDate)) {
    actualStartDate = defaultStartDate
    actualEndDate = defaultEndDate
  }

  let reportData = null
  let errorMsg = null
  let hasAccounts = false
  let companySlug = 'empresa'

  try {
    // 1. Busca dados do balanço usando o intervalo de datas
    const rawData = await getBalanceSheetRawData(context.companyId, actualStartDate, actualEndDate)
    hasAccounts = rawData.accounts.length > 0
    if (hasAccounts) {
      reportData = calculateBalanceSheet(rawData, actualEndDate)
    }

    // 2. Busca nome da empresa para exportação
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
    errorMsg = error.message || 'Erro desconhecido ao carregar o Balanço Patrimonial.'
  }

  // Prepara dados de CSV (caso possua dados reais)
  const csvRows = reportData ? mapBalanceSheetToCsvRows(reportData) : []
  const csvFilename = `balanco_${companySlug}_${actualStartDate}_a_${actualEndDate}.csv`

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 text-sky-700 rounded-lg border border-sky-100">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Balanço Patrimonial</h2>
            <p className="text-sm text-gray-500">Demostração acumulada de Ativos, Passivos e Patrimônio Líquido da organização.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 font-medium w-fit">
            Posição em: <span className="text-gray-700 font-bold">{formatDateBR(actualEndDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <ExportCsvButton filename={csvFilename} rows={csvRows} headers={BALANCE_SHEET_CSV_HEADERS} />
            <PrintButton />
          </div>
        </div>
      </div>

      {/* Filtros de data de tela */}
      <ReportDateFilter defaultStartDate={defaultStartDate} defaultEndDate={defaultEndDate} />

      {/* Trata Estado de Erro */}
      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 space-y-4 max-w-2xl">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
            <div>
              <strong className="font-semibold block mb-1">Falha ao Conectar ao Banco de Dados</strong>
              <p className="text-sm leading-relaxed text-red-700">{errorMsg}</p>
            </div>
          </div>
        </div>
      ) : !hasAccounts ? (
        /* Trata Estado Vazio (Sem plano de contas cadastrado) */
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-2xl text-amber-900 space-y-4">
          <div className="flex gap-3">
            <HelpCircle className="w-6 h-6 flex-shrink-0 text-amber-600" />
            <div>
              <strong className="font-semibold text-base block mb-1">Plano de Contas Inexistente</strong>
              <p className="text-sm leading-relaxed text-amber-800">
                A empresa ativa ({context.companyId}) não possui contas patrimoniais (Ativos, Passivos ou PL) cadastradas no plano de contas para o período de **{formatDateBR(actualStartDate)}** a **{formatDateBR(actualEndDate)}**.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Renderiza Relatório do Balanço timbrado para impressão */
        <div className="space-y-4">
          {/* Cabeçalho formal visível na impressão */}
          <ReportHeader
            companyId={context.companyId}
            title="BALANÇO PATRIMONIAL"
            startDate={actualStartDate}
            endDate={actualEndDate}
            reportType="balanco"
          />
          
          <BalanceSheetTable data={reportData!} />

          {/* Rodapé formal visível na impressão */}
          <ReportFooter companyId={context.companyId} endDate={actualEndDate} showSigningDate={true} />
        </div>
      )}
    </div>
  )
}
