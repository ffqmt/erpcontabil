import React from 'react'
import { getClient } from '@/lib/supabase/server'

interface ReportFooterProps {
  companyId: string
  endDate: string
  showSigningDate?: boolean
}

async function getCompanySignatureInfo(companyId: string) {
  const db = await getClient()

  try {
    const { data } = await db
      .from('companies')
      .select('legal_name, trade_name, responsible_name, responsible_cpf, responsible_role, responsible_crc, city, state')
      .eq('id', companyId)
      .single()
    
    return data
  } catch (err) {
    console.error('Falha ao buscar dados da empresa para assinatura no ReportFooter:', err)
    return null
  }
}

function formatDateLong(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  const day = parseInt(parts[2])
  const month = monthNames[parseInt(parts[1]) - 1]
  const year = parts[0]
  return `${day} de ${month} de ${year}`
}

export async function ReportFooter({
  companyId,
  endDate,
  showSigningDate = false
}: ReportFooterProps) {
  const company = await getCompanySignatureInfo(companyId)
  
  const legalName = company?.legal_name || company?.trade_name || 'Empresa Contábil Demo'
  const cityStr = company?.city 
    ? `${company.city.toUpperCase()}${company.state ? ` - ${company.state.toUpperCase()}` : ''}`
    : 'SÃO PAULO - SP'

  return (
    <div className="hidden print:block w-full mt-12 font-mono text-[9px] text-black leading-normal select-none">
      {/* Cidade e data de assinatura, se aplicável */}
      {showSigningDate && endDate && (
        <div className="mb-8 uppercase font-semibold">
          {cityStr}, {formatDateLong(endDate)}
        </div>
      )}

      {/* Campos de Assinaturas */}
      <div className="flex justify-around items-start pt-8 gap-8">
        {/* Bloco do Responsável Legal */}
        <div className="text-center w-80 space-y-1">
          <div className="border-t border-black w-full mb-1" />
          <span className="font-bold uppercase block text-[10px]">
            {company?.responsible_name || 'RESPONSÁVEL LEGAL'}
          </span>
          <span className="block text-[9px] uppercase">
            {company?.responsible_role || 'ADMINISTRADOR'}
          </span>
          {company?.responsible_cpf && (
            <span className="text-[9px] block text-gray-500">CPF: {company.responsible_cpf}</span>
          )}
        </div>

        {/* Bloco do Contador */}
        <div className="text-center w-80 space-y-1">
          <div className="border-t border-black w-full mb-1" />
          <span className="font-bold uppercase block text-[10px]">CONTAUDI ASSESSORIA CONTABIL LTDA</span>
          <span className="block text-[9px]">Reg. no CRC - MT sob o No. MT000388OO6</span>
          <span className="text-[9px] block text-gray-500">CPF: 905.119.489-72</span>
        </div>
      </div>

      {/* Nota de Encerramento e Licenciador */}
      <div className="flex justify-between items-center mt-12 text-[9px] border-t border-black pt-2">
        <span>Sistema licenciado para CONTAUDI ASSESSORIA CONTABIL LTDA - ME</span>
        <div>Folha:&nbsp;<span className="page-number-counter" /></div>
      </div>
    </div>
  )
}

