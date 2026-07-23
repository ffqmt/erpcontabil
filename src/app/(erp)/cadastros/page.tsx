import React from 'react'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import { getPartners } from '@/modules/registrations/partners/queries'
import { getItems } from '@/modules/registrations/items/queries'
import { getFiscalNatures } from '@/modules/registrations/fiscal-natures/queries'
import { getBankAccounts } from '@/modules/registrations/bank-accounts/queries'
import { Users, Package, FileStack, Landmark, MapPin, AlertCircle, Info, Building2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

function DashboardCard({
  title,
  value,
  subtext,
  icon: Icon
}: {
  title: string
  value: number
  subtext: string
  icon: React.ComponentType<any>
}) {
  return (
    <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm flex items-start justify-between gap-4">
      <div className="space-y-2">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{title}</span>
        <h4 className="text-xl font-bold text-gray-800 tracking-tight">{value}</h4>
        <span className="text-[10px] text-gray-400 block font-medium">{subtext}</span>
      </div>
      <div className="p-2.5 rounded-lg bg-gray-50 text-gray-500 border border-gray-200">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  )
}

function ShortcutCard({ href, title, desc, icon: Icon }: { href: string; title: string; desc: string; icon: React.ComponentType<any> }) {
  return (
    <Link
      href={href}
      className="p-4 border border-gray-150 hover:border-emerald-500 rounded-lg group transition-all flex items-start gap-3 bg-white"
    >
      <Icon className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors mt-0.5" />
      <div className="min-w-0">
        <span className="font-bold text-gray-800 text-sm block group-hover:text-emerald-700 transition-colors">{title}</span>
        <p className="text-[11px] text-gray-400 leading-normal">{desc}</p>
      </div>
    </Link>
  )
}

export default async function CadastrosDashboardPage() {
  const context = await getCurrentContext()

  let errorMsg: string | null = null
  let partnersCount = 0
  let customersCount = 0
  let suppliersCount = 0
  let itemsActiveCount = 0
  let bankAccountsCount = 0
  let fiscalNaturesCount = 0

  try {
    const [partners, items, fiscalNatures, bankAccounts] = await Promise.all([
      getPartners(context.companyId),
      getItems(context.companyId),
      getFiscalNatures(context.companyId),
      getBankAccounts(context.companyId)
    ])

    const activePartners = partners.filter((p) => p.active)
    partnersCount = activePartners.length
    customersCount = activePartners.filter((p) => p.is_customer).length
    suppliersCount = activePartners.filter((p) => p.is_supplier).length
    itemsActiveCount = items.filter((i) => i.active).length
    bankAccountsCount = bankAccounts.filter((b) => b.active).length
    fiscalNaturesCount = fiscalNatures.filter((f) => f.is_active).length
  } catch (error: any) {
    console.error('Erro ao carregar dashboard de Cadastros:', error)
    errorMsg = error.message || 'Falha ao carregar os indicadores de cadastros.'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Cadastros Base</h2>
            <p className="text-sm text-gray-500">Parceiros, produtos/serviços, naturezas fiscais e contas bancárias compartilhados entre os módulos do ERP.</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-2.5 items-start">
        <Info className="w-4.5 h-4.5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          Esta seção contém apenas cadastros estruturais. Regras fiscais, financeiras, de folha e de patrimônio serão implementadas nos módulos correspondentes, ainda a construir.
        </p>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 space-y-2 max-w-2xl">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
            <div>
              <strong className="font-semibold block mb-1">Falha ao Carregar Cadastros</strong>
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <DashboardCard title="Parceiros Ativos" value={partnersCount} subtext="Total de parceiros com cadastro ativo" icon={Users} />
          <DashboardCard title="Clientes" value={customersCount} subtext="Parceiros com papel Cliente" icon={Users} />
          <DashboardCard title="Fornecedores" value={suppliersCount} subtext="Parceiros com papel Fornecedor" icon={Users} />
          <DashboardCard title="Itens Ativos" value={itemsActiveCount} subtext="Produtos e serviços cadastrados" icon={Package} />
          <DashboardCard title="Contas Bancárias" value={bankAccountsCount} subtext="Contas bancárias ativas" icon={Landmark} />
          <DashboardCard title="Naturezas Fiscais" value={fiscalNaturesCount} subtext="Naturezas de operação ativas" icon={FileStack} />
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Acesso Rápido</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ShortcutCard href="/cadastros/empresas" title="Empresas" desc="Cadastro de empresas-cliente do escritório" icon={Building2} />
          <ShortcutCard href="/cadastros/parceiros" title="Parceiros" desc="Clientes, fornecedores, transportadoras e colaboradores" icon={Users} />
          <ShortcutCard href="/cadastros/itens" title="Produtos/Serviços" desc="Catálogo estrutural de itens" icon={Package} />
          <ShortcutCard href="/cadastros/naturezas-fiscais" title="Naturezas Fiscais" desc="Operações de entrada e saída" icon={FileStack} />
          <ShortcutCard href="/cadastros/contas-bancarias" title="Contas Bancárias" desc="Cadastro estrutural, sem conciliação" icon={Landmark} />
          <ShortcutCard href="/cadastros/municipios" title="Municípios/UF" desc="Catálogo de referência (somente leitura)" icon={MapPin} />
        </div>
      </div>
    </div>
  )
}
