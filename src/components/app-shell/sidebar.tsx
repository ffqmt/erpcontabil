'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Bookmark,
  Boxes,
  Building2,
  Calculator,
  Calendar,
  ClipboardList,
  FileSearch,
  FileStack,
  FileText,
  FileUp,
  Grid3X3,
  Landmark,
  LayoutDashboard,
  ListFilter,
  Lock,
  Percent,
  ScrollText,
  Settings2,
  ShieldAlert,
  Scale,
  Users,
  Warehouse
} from 'lucide-react'

interface SidebarProps {
  workspaceName: string
}

type ActiveMatch = 'exact' | 'prefix' | 'none'
type NavIcon = React.ComponentType<{ className?: string }>

interface NavItem {
  name: string
  href: string
  icon: NavIcon
  activeMatch?: ActiveMatch
}

interface NavSection {
  title?: string
  items: NavItem[]
}

interface ModuleNavContext {
  matcher: (pathname: string) => boolean
  label: string
  title: string
  footer: string
  sections: NavSection[]
}

const GLOBAL_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { name: 'Visão Geral', href: '/', icon: LayoutDashboard, activeMatch: 'exact' },
      { name: 'Módulos', href: '/#modulos', icon: Grid3X3, activeMatch: 'none' },
      { name: 'Cadastros', href: '/cadastros', icon: Users, activeMatch: 'prefix' },
      { name: 'Relatórios', href: '/#relatorios', icon: BarChart3, activeMatch: 'none' },
      { name: 'Configurações', href: '/#configuracoes', icon: Settings2, activeMatch: 'none' }
    ]
  }
]

const FISCAL_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { name: 'Voltar para Visão Geral', href: '/', icon: ArrowLeft, activeMatch: 'none' },
      { name: 'Fiscal', href: '/fiscal', icon: Percent, activeMatch: 'none' }
    ]
  },
  {
    title: 'Operação',
    items: [
      { name: 'Painel', href: '/fiscal', icon: LayoutDashboard, activeMatch: 'exact' },
      { name: 'Importar XML', href: '/fiscal/importar-xml', icon: FileUp, activeMatch: 'prefix' },
      { name: 'Documentos', href: '/fiscal/documentos', icon: FileText, activeMatch: 'prefix' },
      { name: 'Pendências', href: '/fiscal/pendencias', icon: AlertTriangle, activeMatch: 'prefix' },
      { name: 'Revisão de Itens', href: '/fiscal/revisao-itens', icon: FileSearch, activeMatch: 'prefix' }
    ]
  },
  {
    title: 'Fechamento',
    items: [
      { name: 'Apurações', href: '/fiscal/apuracoes', icon: Calculator, activeMatch: 'prefix' }
    ]
  },
  {
    title: 'Configuração',
    items: [
      { name: 'Naturezas Fiscais', href: '/cadastros/naturezas-fiscais', icon: FileStack, activeMatch: 'prefix' },
      { name: 'Regras de Importação', href: '/fiscal/configuracoes/regras-importacao', icon: ListFilter, activeMatch: 'prefix' },
      { name: 'Parâmetros Fiscais', href: '/fiscal/configuracoes-tributarias', icon: Settings2, activeMatch: 'prefix' }
    ]
  },
  {
    title: 'Atalhos',
    items: [
      { name: 'Tabelas Fiscais', href: '/fiscal/cadastros/tabelas-nacionais', icon: BookOpen, activeMatch: 'prefix' },
      { name: 'Estabelecimentos', href: '/fiscal/cadastros/estabelecimentos', icon: Warehouse, activeMatch: 'prefix' },
      { name: 'Regras Contábeis', href: '/fiscal/regras-contabeis', icon: ScrollText, activeMatch: 'prefix' }
    ]
  }
]

const ACCOUNTING_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { name: 'Voltar para Visão Geral', href: '/', icon: ArrowLeft, activeMatch: 'none' },
      { name: 'Contabilidade', href: '/contabilidade', icon: Calculator, activeMatch: 'none' }
    ]
  },
  {
    title: 'Operação',
    items: [
      { name: 'Painel Contábil', href: '/contabilidade', icon: LayoutDashboard, activeMatch: 'exact' },
      { name: 'Lançamentos', href: '/contabilidade/lancamentos', icon: FileText, activeMatch: 'prefix' }
    ]
  },
  {
    title: 'Cadastros',
    items: [
      { name: 'Plano de Contas', href: '/contabilidade/plano-contas', icon: FileStack, activeMatch: 'prefix' },
      { name: 'Períodos', href: '/contabilidade/periodos', icon: Lock, activeMatch: 'prefix' }
    ]
  },
  {
    title: 'Relatórios',
    items: [
      { name: 'Diário', href: '/contabilidade/diario', icon: BookOpen, activeMatch: 'prefix' },
      { name: 'Balancete', href: '/contabilidade/balancete', icon: ClipboardList, activeMatch: 'prefix' },
      { name: 'DRE', href: '/contabilidade/dre', icon: BarChart3, activeMatch: 'prefix' },
      { name: 'Balanço', href: '/contabilidade/balanco', icon: Scale, activeMatch: 'prefix' }
    ]
  },
  {
    title: 'Fechamento',
    items: [
      { name: 'Encerramento', href: '/contabilidade/encerramento', icon: Bookmark, activeMatch: 'prefix' }
    ]
  }
]

const BANKING_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { name: 'Voltar para Visão Geral', href: '/', icon: ArrowLeft, activeMatch: 'none' },
      { name: 'Bancos', href: '/bancos', icon: Landmark, activeMatch: 'none' }
    ]
  },
  {
    title: 'Operação',
    items: [
      { name: 'Painel Bancário', href: '/bancos', icon: LayoutDashboard, activeMatch: 'exact' },
      { name: 'Importar Extrato', href: '/bancos/importar', icon: FileUp, activeMatch: 'prefix' },
      { name: 'Extratos Importados', href: '/bancos/extratos', icon: FileStack, activeMatch: 'prefix' },
      { name: 'Conciliação', href: '/bancos/conciliacao', icon: ClipboardList, activeMatch: 'prefix' }
    ]
  },
  {
    title: 'Configuração',
    items: [
      { name: 'Regras Bancárias', href: '/bancos/regras', icon: Settings2, activeMatch: 'prefix' }
    ]
  }
]

const PAYROLL_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { name: 'Voltar para Visão Geral', href: '/', icon: ArrowLeft, activeMatch: 'none' },
      { name: 'Folha', href: '/folha', icon: Users, activeMatch: 'none' }
    ]
  },
  {
    title: 'Operação',
    items: [
      { name: 'Eventos eSocial', href: '/folha', icon: Users, activeMatch: 'exact' },
      { name: 'Importar eSocial', href: '/folha/importar-esocial', icon: FileUp, activeMatch: 'prefix' }
    ]
  }
]

const OBLIGATIONS_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { name: 'Voltar para Visão Geral', href: '/', icon: ArrowLeft, activeMatch: 'none' },
      { name: 'Obrigações', href: '/obrigacoes', icon: ShieldAlert, activeMatch: 'none' }
    ]
  },
  {
    title: 'Operação',
    items: [
      { name: 'Agenda/Guias', href: '/obrigacoes', icon: Calendar, activeMatch: 'exact' },
      { name: 'Nova Obrigação', href: '/obrigacoes/novo', icon: FileText, activeMatch: 'prefix' }
    ]
  }
]

const ASSETS_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { name: 'Voltar para Visão Geral', href: '/', icon: ArrowLeft, activeMatch: 'none' },
      { name: 'Patrimônio', href: '/patrimonio', icon: Boxes, activeMatch: 'none' }
    ]
  },
  {
    title: 'Operação',
    items: [
      { name: 'Painel Patrimonial', href: '/patrimonio', icon: LayoutDashboard, activeMatch: 'exact' },
      { name: 'Bens', href: '/patrimonio/bens', icon: Building2, activeMatch: 'prefix' },
      { name: 'Categorias', href: '/patrimonio/categorias', icon: FileStack, activeMatch: 'prefix' },
      { name: 'Depreciações', href: '/patrimonio/depreciacoes', icon: Calculator, activeMatch: 'prefix' }
    ]
  }
]

function pathMatches(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
}

const MODULE_NAV_CONTEXTS: ModuleNavContext[] = [
  {
    matcher: (pathname) => pathMatches(pathname, '/fiscal'),
    label: 'Módulo Fiscal',
    title: 'Fiscal',
    footer: 'Contexto Fiscal',
    sections: FISCAL_NAV_SECTIONS
  },
  {
    matcher: (pathname) => pathMatches(pathname, '/contabilidade'),
    label: 'Módulo Contábil',
    title: 'Contabilidade',
    footer: 'Contexto Contábil',
    sections: ACCOUNTING_NAV_SECTIONS
  },
  {
    matcher: (pathname) => pathMatches(pathname, '/bancos'),
    label: 'Módulo Bancário',
    title: 'Bancos',
    footer: 'Contexto Bancário',
    sections: BANKING_NAV_SECTIONS
  },
  {
    matcher: (pathname) => pathMatches(pathname, '/folha'),
    label: 'Módulo Folha',
    title: 'Folha',
    footer: 'Contexto Folha',
    sections: PAYROLL_NAV_SECTIONS
  },
  {
    matcher: (pathname) => pathMatches(pathname, '/patrimonio'),
    label: 'Módulo Patrimônio',
    title: 'Patrimônio',
    footer: 'Contexto Patrimonial',
    sections: ASSETS_NAV_SECTIONS
  },
  {
    matcher: (pathname) => pathMatches(pathname, '/obrigacoes'),
    label: 'Módulo Obrigações',
    title: 'Obrigações',
    footer: 'Contexto Obrigações',
    sections: OBLIGATIONS_NAV_SECTIONS
  }
]

function stripHashAndQuery(href: string): string {
  return href.split('#')[0].split('?')[0] || '/'
}

function getModuleNavContext(pathname: string): ModuleNavContext | null {
  return MODULE_NAV_CONTEXTS.find((context) => context.matcher(pathname)) || null
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.activeMatch === 'none') return false

  const hrefPath = stripHashAndQuery(item.href)
  const activeMatch = item.activeMatch || (hrefPath === '/' ? 'exact' : 'prefix')

  if (activeMatch === 'exact') return pathname === hrefPath
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`)
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon
  const active = isActive(pathname, item)

  return (
    <Link
      href={item.href}
      prefetch={false}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="truncate">{item.name}</span>
    </Link>
  )
}

export function Sidebar({ workspaceName }: SidebarProps) {
  const pathname = usePathname()
  const moduleContext = getModuleNavContext(pathname)
  const sections = moduleContext ? moduleContext.sections : GLOBAL_NAV_SECTIONS

  return (
    <aside className="w-64 bg-gray-900 text-gray-100 flex flex-col h-screen fixed left-0 top-0 border-r border-gray-800 z-30 print:hidden">
      <div className="p-5 border-b border-gray-800 flex flex-col gap-1">
        <span className="text-xs text-emerald-400 font-semibold uppercase tracking-widest">
          {moduleContext ? moduleContext.label : 'Workspace'}
        </span>
        <h2 className="text-lg font-bold truncate text-white" title={workspaceName}>
          {moduleContext ? moduleContext.title : workspaceName || 'Escritório Demo'}
        </h2>
        {moduleContext && (
          <span className="text-[11px] text-gray-500 truncate" title={workspaceName}>
            {workspaceName || 'Escritório Demo'}
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-800">
        {sections.map((section, sectionIndex) => (
          <div key={section.title || `section-${sectionIndex}`} className="space-y-2">
            {section.title && (
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={`${section.title || 'main'}-${item.href}-${item.name}`}>
                  <NavLink item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800 text-xs text-gray-500 flex flex-col gap-1 bg-gray-950/40">
        <div className="flex items-center justify-between">
          <span>{moduleContext ? moduleContext.footer : 'Ambiente ERP'}</span>
          <span className="px-1.5 py-0.5 bg-gray-800 text-amber-500 rounded text-[9px] font-bold tracking-wider uppercase">
            Modo Dev
          </span>
        </div>
        <p className="text-[10px] text-gray-600 mt-1">
          Supabase PostgreSQL
        </p>
      </div>
    </aside>
  )
}
