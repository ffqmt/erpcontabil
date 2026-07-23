'use client'

import React from 'react'
import { CompanySwitcher } from './company-switcher'
import { PeriodSelector } from './period-selector'
import { User, LogOut } from 'lucide-react'
import { signOutAction } from '@/app/login/actions'

interface TopbarProps {
  companyId: string
  legalName: string
  competence: string
  periodStatus: string
  userName: string
  userEmail: string
  companies: { id: string; legal_name: string }[]
}

export function Topbar({
  companyId,
  legalName,
  competence,
  periodStatus,
  userName,
  userEmail,
  companies
}: TopbarProps) {
  return (
    <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm ml-64 print:hidden">
      {/* Lado Esquerdo: Identificação & Título */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-base font-bold text-gray-800 tracking-tight">ERP Contábil</h1>
          <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium inline-block mt-0.5" title="A integração final de Auth e SSO será via Francoos.">
            ⚠️ Integração Francoos pendente (SSO/Auth)
          </p>
        </div>
      </div>

      {/* Lado Direito: Empresa Ativa, Período e Usuário */}
      <div className="flex items-center gap-4">
        {/* Switchers Contábeis */}
        <CompanySwitcher companyId={companyId} legalName={legalName} companies={companies} />
        <PeriodSelector competence={competence} periodStatus={periodStatus} />

        {/* Card Usuário + Logout */}
        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <div className="flex flex-col text-right hidden sm:flex">
            <span className="text-xs font-semibold text-gray-800">{userName || 'Usuário Dev'}</span>
            <span className="text-[10px] text-gray-400 font-mono">{userEmail || 'dev@contabil.model.com'}</span>
          </div>
          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 border border-gray-200 shadow-inner relative">
            <User className="w-5 h-5" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" title="Usuário Ativo" />
          </div>
          {/* Botão logout mínimo */}
          <form action={signOutAction}>
            <button
              type="submit"
              title="Sair"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}

