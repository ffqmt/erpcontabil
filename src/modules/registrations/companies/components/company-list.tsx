import React from 'react'
import { Company } from '../types'
import { CompanyCard } from './company-card'
import { Building2 } from 'lucide-react'

interface CompanyListProps {
  companies: Company[]
  activeCompanyId: string
}

export function CompanyList({ companies, activeCompanyId }: CompanyListProps) {
  if (companies.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <Building2 className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhuma empresa cadastrada</span>
        <p className="text-xs text-gray-400 max-w-xs">Clique em &quot;Nova Empresa&quot; para cadastrar a primeira empresa-cliente deste escritório.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {companies.map((company) => (
        <CompanyCard key={company.id} company={company} isActiveInContext={company.id === activeCompanyId} />
      ))}
    </div>
  )
}
