'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Company, TAX_REGIME_LABELS, COMPANY_PROFILE_LABELS } from '../types'
import { toggleCompanyActiveAction } from '../actions'
import { Pencil, Power, Building2 } from 'lucide-react'

interface CompanyCardProps {
  company: Company
  isActiveInContext: boolean
}

export function CompanyCard({ company, isActiveInContext }: CompanyCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    if (company.active) {
      const activeWarning = isActiveInContext
        ? `\n\nATENÇÃO: Esta é a empresa ATIVA ATUAL do sistema! Ao inativá-la, o sistema tentará selecionar automaticamente outra empresa ativa no mesmo workspace.`
        : '';
      const promptMsg = `Você está prestes a INATIVAR a empresa "${company.legal_name}".${activeWarning}\n\nNovas operações e lançamentos nesta empresa serão bloqueados. O histórico e os dados existentes serão preservados.\n\nPara confirmar a inativação, digite exatamente "INATIVAR" no campo abaixo:`
      
      const userInput = window.prompt(promptMsg)
      if (userInput !== 'INATIVAR') {
        if (userInput !== null) {
          window.alert('Operação cancelada: confirmação incorreta.')
        }
        return
      }
    } else {
      if (!window.confirm(`Deseja REATIVAR a empresa "${company.legal_name}"?`)) return
    }

    startTransition(async () => {
      const res = await toggleCompanyActiveAction({ id: company.id, active: !company.active })
      if (!res.ok) {
        window.alert(res.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between hover:shadow-sm transition-shadow">
      <div className="space-y-1 min-w-0 flex items-start gap-3">
        <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 flex-shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800 text-sm truncate">{company.legal_name}</span>
            {isActiveInContext && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Ativa no contexto</span>
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${company.active ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-600'}`}>
              {company.active ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-mono">{company.cnpj}</p>
          <p className="text-xs text-gray-400">{TAX_REGIME_LABELS[company.tax_regime]} · {COMPANY_PROFILE_LABELS[company.company_profile]}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/cadastros/empresas/${company.id}/editar`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Link>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
            company.active
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-green-200 text-green-700 hover:bg-green-50'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {company.active ? 'Inativar' : 'Reativar'}
        </button>
      </div>
    </div>
  )
}
