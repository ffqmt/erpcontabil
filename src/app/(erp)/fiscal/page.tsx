import React from 'react'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  Calculator,
  FileSearch,
  FileStack,
  FileText,
  FileUp,
  ListFilter,
  Percent,
  Settings2
} from 'lucide-react'

export const dynamic = 'force-dynamic'

type CardIcon = React.ComponentType<{ className?: string }>

interface FiscalHubCardProps {
  href: string
  title: string
  description: string
  icon: CardIcon
}

function formatCompetence(dateStr: string) {
  if (!dateStr) return '-'
  const [year, month] = dateStr.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const monthName = months[(Number(month) || 1) - 1] || month
  return `${monthName}/${year}`
}

function FiscalHubCard({ href, title, description, icon: Icon }: FiscalHubCardProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4 hover:border-emerald-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
          <Icon className="w-5 h-5" />
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300" />
      </div>
      <div>
        <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
      </div>
    </Link>
  )
}

export default async function FiscalDashboardPage() {
  const context = await getCurrentContext()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Fiscal</h2>
            <p className="text-sm text-gray-500">Operação, escrituração, pendências, apuração e parâmetros fiscais.</p>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Empresa</span>
          <h3 className="font-bold text-gray-900 truncate mt-1" title={context.activeCompany.legal_name}>
            {context.activeCompany.legal_name}
          </h3>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Competência</span>
          <h3 className="font-bold text-gray-900 mt-1">{formatCompetence(context.competence)}</h3>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Fluxo Sugerido</span>
          <h3 className="font-bold text-gray-900 mt-1">Importar, revisar, apurar</h3>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Operação</h3>
          <p className="text-sm text-gray-500">Entrada e revisão dos documentos fiscais da competência.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <FiscalHubCard href="/fiscal/importar-xml" title="Importar XML" description="Importe NF-e, CT-e e NFS-e para escrituração." icon={FileUp} />
          <FiscalHubCard href="/fiscal/documentos" title="Documentos" description="Liste, valide, edite e acompanhe o rastro fiscal." icon={FileText} />
          <FiscalHubCard href="/fiscal/pendencias" title="Pendências" description="Central de inconsistências e bloqueios operacionais." icon={AlertTriangle} />
          <FiscalHubCard href="/fiscal/revisao-itens" title="Revisão de Itens" description="Fila de itens de XML sem vínculo ou com baixa confiança." icon={FileSearch} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Fechamento</h3>
          <p className="text-sm text-gray-500">Rotinas que consolidam a competência fiscal.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <FiscalHubCard href="/fiscal/apuracoes" title="Apurações" description="Calcule, revise e acompanhe apurações tributárias." icon={Calculator} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Configuração</h3>
          <p className="text-sm text-gray-500">Bases e regras usadas pelo motor fiscal.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <FiscalHubCard href="/cadastros/naturezas-fiscais" title="Naturezas Fiscais" description="Operações fiscais, comportamento e integração contábil." icon={FileStack} />
          <FiscalHubCard href="/fiscal/configuracoes/regras-importacao" title="Regras de Importação" description="Classifique XMLs automaticamente por parceiro, CFOP e item." icon={ListFilter} />
          <FiscalHubCard href="/fiscal/configuracoes-tributarias" title="Parâmetros Fiscais" description="Alíquotas, regimes e configurações de apuração." icon={Settings2} />
          <FiscalHubCard href="/fiscal/regras-contabeis" title="Regras Contábeis" description="Regras de contabilização e rastro contábil fiscal." icon={BookOpen} />
          <FiscalHubCard href="/fiscal/cadastros/tabelas-nacionais" title="Tabelas Fiscais" description="NCM, CEST, CFOP, CST/CSOSN e serviços municipais." icon={BookOpen} />
          <FiscalHubCard href="/fiscal/cadastros/estabelecimentos" title="Estabelecimentos" description="Matriz e filiais com inscrições fiscais." icon={Building2} />
        </div>
      </section>
    </div>
  )
}
