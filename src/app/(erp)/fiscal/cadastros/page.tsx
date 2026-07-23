import React from 'react'
import Link from 'next/link'
import { Building2, BookOpen, Package, Percent, ClipboardList } from 'lucide-react'

export const dynamic = 'force-dynamic'

const CARDS = [
  {
    href: '/fiscal/cadastros/estabelecimentos',
    icon: Building2,
    title: 'Estabelecimentos',
    description: 'Matriz e filiais desta empresa, cada uma com sua IE/IM.'
  },
  {
    href: '/fiscal/cadastros/tabelas-nacionais',
    icon: BookOpen,
    title: 'Tabelas Nacionais',
    description: 'NCM, CEST, CFOP, CST/CSOSN e códigos de serviço municipal.'
  },
  {
    href: '/cadastros/itens',
    icon: Package,
    title: 'Produtos e Serviços',
    description: 'Catálogo com CEST, GTIN, natureza fiscal padrão e uso fiscal.'
  },
  {
    href: '/fiscal/configuracoes-tributarias',
    icon: Percent,
    title: 'Configurações Tributárias',
    description: 'Alíquotas por regime, vigência e crédito de PIS/COFINS.'
  },
  {
    href: '/fiscal/revisao-itens',
    icon: ClipboardList,
    title: 'Revisão de Itens Importados',
    description: 'Fila de itens de XML sem produto vinculado ou com match fraco.'
  }
]

export default function FiscalRegistrationsHubPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Cadastros Fiscais</h2>
          <p className="text-sm text-gray-500">Base estrutural do módulo fiscal — estabelecimentos, tabelas nacionais e classificação de itens.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col gap-3"
          >
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 w-fit">
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">{card.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
