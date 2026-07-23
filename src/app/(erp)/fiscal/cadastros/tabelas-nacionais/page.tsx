import React from 'react'
import { searchNcmCodes, searchCestCodes, searchCfopCodes, searchTaxSituationCodes, searchMunicipalServiceCodes } from '@/modules/fiscal-codes/queries'
import { FiscalCodesConsultation } from '@/modules/fiscal-codes/components/fiscal-codes-consultation'
import { BookOpen } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ tab?: string; search?: string }>
}

export default async function FiscalCodesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const activeTab = (params.tab || 'ncm') as 'ncm' | 'cest' | 'cfop' | 'cst' | 'servico'
  const search = params.search || ''

  const [ncmCodes, cestCodes, cfopCodes, taxSituationCodes, municipalServiceCodes] = await Promise.all([
    activeTab === 'ncm' ? searchNcmCodes(search) : Promise.resolve([]),
    activeTab === 'cest' ? searchCestCodes(search) : Promise.resolve([]),
    activeTab === 'cfop' ? searchCfopCodes(search) : Promise.resolve([]),
    activeTab === 'cst' ? searchTaxSituationCodes(undefined, search) : Promise.resolve([]),
    activeTab === 'servico' ? searchMunicipalServiceCodes(search) : Promise.resolve([])
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Tabelas Fiscais Nacionais</h2>
          <p className="text-sm text-gray-500">Consulta de NCM, CEST, CFOP, CST/CSOSN e códigos de serviço municipal.</p>
        </div>
      </div>

      <FiscalCodesConsultation
        activeTab={activeTab}
        search={search}
        ncmCodes={ncmCodes}
        cestCodes={cestCodes}
        cfopCodes={cfopCodes}
        taxSituationCodes={taxSituationCodes}
        municipalServiceCodes={municipalServiceCodes}
      />
    </div>
  )
}
