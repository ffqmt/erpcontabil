import React from 'react'
import { getClient } from '@/lib/supabase/server'
import { Landmark, Calendar, Hash } from 'lucide-react'

interface ReportHeaderProps {
  companyId: string
  title: string
  startDate: string
  endDate: string
  reportType?: 'balancete' | 'dre' | 'balanco'
}

/**
 * Busca dados reais de Razão Social, Nome Fantasia, CNPJ, NIRE e Data de Abertura da empresa no Supabase.
 */
async function getCompanyInfo(companyId: string) {
  const db = await getClient()

  try {
    const { data } = await db
      .from('companies')
      .select('legal_name, trade_name, cnpj, nire, incorporation_date')
      .eq('id', companyId)
      .single()
    
    return data
  } catch (err) {
    console.error('Falha ao buscar dados da empresa para ReportHeader:', err)
    return null
  }
}

function formatCNPJ(cnpjStr: string): string {
  if (!cnpjStr) return ''
  const clean = cnpjStr.replace(/\D/g, '')
  if (clean.length !== 14) return cnpjStr
  return `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}/${clean.substring(8, 12)}-${clean.substring(12, 14)}`
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export async function ReportHeader({
  companyId,
  title,
  startDate,
  endDate,
  reportType
}: ReportHeaderProps) {
  const company = await getCompanyInfo(companyId)
  
  const formattedCNPJ = company?.cnpj ? formatCNPJ(company.cnpj) : '00.000.000/0000-00'
  const legalName = company?.legal_name || company?.trade_name || 'Razão Social Contábil Demo'
  
  const startStr = formatDateBR(startDate)
  const endStr = formatDateBR(endDate)

  // Define os títulos e valores finais com base no reportType
  let finalTitle = title
  if (reportType === 'dre') {
    finalTitle = `DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO EM ${endStr}`
  } else if (reportType === 'balancete') {
    finalTitle = 'BALANCETE'
  } else if (reportType === 'balanco') {
    finalTitle = 'BALANÇO PATRIMONIAL'
  }

  return (
    <div className="hidden print:block w-full text-[9px] font-mono text-black mb-4 leading-tight select-none">
      {/* Dados do topo */}
      <div className="flex justify-between items-start">
        <div className="space-y-0.5">
          <div>Empresa:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{legalName}</div>
          <div>C.N.P.J.:&nbsp;&nbsp;&nbsp;&nbsp;{formattedCNPJ}</div>
          {reportType === 'balanco' && (
            <div>Insc. Junta Comercial: {company?.nire || '—'} Data: {company?.incorporation_date ? formatDateBR(company.incorporation_date) : '—'}</div>
          )}
          {reportType === 'balancete' && (
            <div>Período:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{startStr} - {endStr}</div>
          )}
          {reportType === 'balanco' && (
            <div>Período:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{startStr} a {endStr}</div>
          )}
          {reportType === 'dre' && (
            <div>Período:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{startStr} a {endStr}</div>
          )}
          {reportType === 'balanco' && (
            <div>Balanço encerrado em:&nbsp;&nbsp;{endStr}</div>
          )}
        </div>
        <div className="text-right space-y-0.5">
          <div>Folha:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="page-number-counter" /></div>
          {reportType !== 'balanco' && (
            <div>Número livro:&nbsp;0001</div>
          )}
        </div>
      </div>
      
      {/* Linha divisória escura */}
      <div className="border-t border-black mt-2 mb-1" />
      
      {/* Título centralizado */}
      <div className="text-center font-bold text-[11px] my-1 tracking-wide uppercase">
        {finalTitle}
      </div>
      
      <div className="border-t border-black mt-1 mb-2" />
    </div>
  )
}

