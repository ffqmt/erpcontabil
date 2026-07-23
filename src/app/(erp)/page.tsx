import React from 'react'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  Calendar,
  FileStack,
  FileText,
  FileUp,
  Landmark,
  Percent,
  Settings2,
  ShieldAlert,
  Users
} from 'lucide-react'

type CardIcon = React.ComponentType<{ className?: string }>

interface ModuleCardProps {
  title: string
  description: string
  href?: string
  icon: CardIcon
  status: string
}

interface ShortcutCardProps {
  title: string
  description: string
  href: string
  icon: CardIcon
}

function formatCompetence(dateStr: string) {
  if (!dateStr) return '-'
  const [year, month] = dateStr.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const monthName = months[(Number(month) || 1) - 1] || month
  return `${monthName}/${year}`
}

function ModuleCard({ title, description, href, icon: Icon, status }: ModuleCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{status}</span>
      </div>
      <div>
        <h3 className="font-bold text-gray-900 text-base">{title}</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
        {href ? 'Acessar' : 'Indisponível'} {href && <ArrowRight className="w-3.5 h-3.5" />}
      </div>
    </>
  )

  if (!href) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4 opacity-70">
        {content}
      </div>
    )
  }

  return (
    <Link
      href={href}
      prefetch={false}
      className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4 hover:border-emerald-300 hover:shadow-sm transition-all"
    >
      {content}
    </Link>
  )
}

function ShortcutCard({ title, description, href, icon: Icon }: ShortcutCardProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-3 hover:border-emerald-300 hover:shadow-sm transition-all"
    >
      <div className="p-2 rounded-md bg-gray-50 text-gray-500 border border-gray-200">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <h3 className="font-bold text-sm text-gray-800">{title}</h3>
        <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{description}</p>
      </div>
    </Link>
  )
}

export default async function ErpOverviewPage() {
  const context = await getCurrentContext()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Visão Geral</h2>
        <p className="text-sm text-gray-500">
          Hub operacional da empresa ativa, com acesso rápido aos módulos do ERP Sela Sistem.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Empresa Atual</span>
            <h3 className="font-bold text-gray-900 truncate" title={context.activeCompany.legal_name}>
              {context.activeCompany.legal_name}
            </h3>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Competência</span>
            <h3 className="font-bold text-gray-900">{formatCompetence(context.competence)}</h3>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Pendências</span>
            <h3 className="font-bold text-gray-900">Acompanhar nos módulos</h3>
          </div>
        </div>
      </section>

      <section id="modulos" className="space-y-4 scroll-mt-24">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Módulos</h3>
          <p className="text-sm text-gray-500">Entre no universo de trabalho de cada área.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <ModuleCard
            title="Fiscal"
            description="Importação XML, documentos, pendências, revisão e apuração."
            href="/fiscal"
            icon={Percent}
            status="Ativo"
          />
          <ModuleCard
            title="Contabilidade"
            description="Plano de contas, lançamentos, diário, balancete, DRE e balanço."
            href="/contabilidade"
            icon={Calculator}
            status="Ativo"
          />
          <ModuleCard
            title="Bancos"
            description="Extratos, importação, conciliação e regras bancárias."
            href="/bancos"
            icon={Landmark}
            status="Ativo"
          />
          <ModuleCard
            title="Folha"
            description="Eventos, importação e rotinas trabalhistas integradas."
            href="/folha"
            icon={Users}
            status="Ativo"
          />
          <ModuleCard
            title="Patrimônio"
            description="Bens, categorias e depreciações do ativo imobilizado."
            href="/patrimonio"
            icon={Boxes}
            status="Ativo"
          />
          <ModuleCard
            title="Obrigações"
            description="Agenda, guias e obrigações fiscais/contábeis."
            href="/obrigacoes"
            icon={ShieldAlert}
            status="Ativo"
          />
          <ModuleCard
            title="Cadastros"
            description="Empresas, parceiros, produtos, serviços, contas e bases comuns."
            href="/cadastros"
            icon={Building2}
            status="Ativo"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Atalhos Rápidos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <ShortcutCard href="/fiscal/importar-xml" title="Importar XML" description="Entrada rápida de NF-e, CT-e e NFS-e." icon={FileUp} />
          <ShortcutCard href="/fiscal/documentos/novo" title="Novo Documento" description="Cadastro manual de documento fiscal." icon={FileText} />
          <ShortcutCard href="/cadastros/naturezas-fiscais" title="Naturezas Fiscais" description="Operações fiscais usadas no motor." icon={FileStack} />
          <ShortcutCard href="/cadastros/contas-bancarias" title="Contas Bancárias" description="Base compartilhada com o módulo bancário." icon={Landmark} />
        </div>
      </section>

      <section id="relatorios" className="space-y-4 scroll-mt-24">
        <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Relatórios</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <ShortcutCard href="/contabilidade/balancete" title="Balancete" description="Verificação contábil por período." icon={BookOpen} />
          <ShortcutCard href="/contabilidade/dre" title="DRE" description="Demonstração do resultado." icon={BarChart3} />
          <ShortcutCard href="/contabilidade/balanco" title="Balanço" description="Posição patrimonial da empresa." icon={FileStack} />
          <ShortcutCard href="/contabilidade/diario" title="Diário" description="Livro diário e rastreabilidade." icon={FileText} />
        </div>
      </section>

      <section id="configuracoes" className="space-y-4 scroll-mt-24">
        <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Configurações</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <ShortcutCard href="/fiscal/configuracoes-tributarias" title="Parâmetros Fiscais" description="Alíquotas e parâmetros de apuração." icon={Settings2} />
          <ShortcutCard href="/fiscal/configuracoes/regras-importacao" title="Regras de Importação" description="Classificação automática do XML." icon={FileStack} />
          <ShortcutCard href="/contabilidade/periodos" title="Períodos Contábeis" description="Abertura, revisão e fechamento." icon={Calendar} />
          <ShortcutCard href="/cadastros/empresas" title="Empresas" description="Configuração da empresa ativa." icon={Building2} />
        </div>
      </section>
    </div>
  )
}
