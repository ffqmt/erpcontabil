'use client'

import React from 'react'
import { 
  FileSpreadsheet, 
  FileText, 
  BookOpen, 
  ClipboardList, 
  BarChart3, 
  Scale, 
  Lock, 
  Bookmark, 
  PlusCircle,
  ArrowUpRight
} from 'lucide-react'
import Link from 'next/link'

interface AccountingShortcutsProps {
  periodStatus: 'OPEN' | 'IN_REVIEW' | 'CLOSED' | 'REOPENED'
}

export function AccountingShortcuts({ periodStatus }: AccountingShortcutsProps) {
  const isPeriodOpen = periodStatus === 'OPEN' || periodStatus === 'REOPENED'

  const links = [
    {
      name: 'Novo Lançamento',
      href: '/contabilidade/lancamentos',
      desc: isPeriodOpen ? 'Inserir pernas de partidas dobradas' : 'Escrita Bloqueada (Período Fechado)',
      icon: PlusCircle,
      badge: isPeriodOpen ? 'Novo' : 'Trancado',
      badgeColor: isPeriodOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
      disabled: !isPeriodOpen
    },
    {
      name: 'Livro Diário',
      href: '/contabilidade/diario',
      desc: 'Listagem cronológica oficial',
      icon: BookOpen,
      badge: 'Relatório'
    },
    {
      name: 'Balancete',
      href: '/contabilidade/balancete',
      desc: 'Auditoria de saldos analíticos',
      icon: ClipboardList,
      badge: 'Relatório'
    },
    {
      name: 'DRE',
      href: '/contabilidade/dre',
      desc: 'Resultado líquido apurado',
      icon: BarChart3,
      badge: 'Relatório'
    },
    {
      name: 'Balanço Patrimonial',
      href: '/contabilidade/balanco',
      desc: 'Equação de igualdade de Ativos',
      icon: Scale,
      badge: 'Relatório'
    },
    {
      name: 'Encerramento de Resultado',
      href: '/contabilidade/encerramento',
      desc: 'Zerar DRE e transferir para PL',
      icon: Bookmark,
      badge: 'Rotina'
    },
    {
      name: 'Períodos Contábeis',
      href: '/contabilidade/periodos',
      desc: 'Fechamento e reaberturas',
      icon: Lock,
      badge: 'Controle'
    },
    {
      name: 'Plano de Contas',
      href: '/contabilidade/plano-contas',
      desc: 'Hierarquia das contas contábeis',
      icon: FileSpreadsheet,
      badge: 'Setup'
    }
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          Acesso Rápido e Rotinas
        </h3>
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono">Modulos Contábeis</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {links.map((item, idx) => {
          const Icon = item.icon
          const isLct = item.name === 'Novo Lançamento'

          const cardContent = (
            <>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isLct && item.disabled ? 'text-red-500' : 'text-gray-400 group-hover:text-emerald-600'
                  }`} />
                  <span className={`font-bold text-xs truncate transition-colors ${
                    item.disabled ? 'text-gray-500' : 'text-gray-800 group-hover:text-emerald-700'
                  }`}>
                    {item.name}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 leading-normal truncate">
                  {item.desc}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  item.badgeColor || 'bg-gray-100 text-gray-500'
                }`}>
                  {item.badge}
                </span>
                {!item.disabled && (
                  <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 -translate-y-1" />
                )}
              </div>
            </>
          )

          // AUDITORIA (Etapa 15, achado B2): antes, o atalho "Novo Lançamento" permanecia
          // um <Link> navegável mesmo com o badge "Trancado" — clicar levava normalmente à
          // tela de lançamentos. Agora, quando desabilitado, renderiza como um bloco inerte
          // (sem href, sem hover, aria-disabled) — genuinamente não-clicável, não só estilizado.
          if (item.disabled) {
            return (
              <div
                key={idx}
                aria-disabled="true"
                title="Criação de lançamentos bloqueada: período contábil fechado."
                className="p-3 border border-gray-150 rounded-lg flex items-start justify-between gap-3 text-left opacity-60 cursor-not-allowed select-none"
              >
                {cardContent}
              </div>
            )
          }

          return (
            <Link
              key={idx}
              href={item.href}
              className="p-3 border border-gray-150 hover:border-emerald-500 rounded-lg group transition-all flex items-start justify-between gap-3 text-left"
            >
              {cardContent}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
