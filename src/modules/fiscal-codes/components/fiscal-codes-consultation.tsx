'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, BookOpen } from 'lucide-react'
import { NcmCode, CestCode, CfopCode, TaxSituationCode, MunicipalServiceCode } from '../types'

type TabKey = 'ncm' | 'cest' | 'cfop' | 'cst' | 'servico'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'ncm', label: 'NCM' },
  { key: 'cest', label: 'CEST' },
  { key: 'cfop', label: 'CFOP' },
  { key: 'cst', label: 'CST / CSOSN' },
  { key: 'servico', label: 'Serviço Municipal' }
]

interface FiscalCodesConsultationProps {
  activeTab: TabKey
  search: string
  ncmCodes: NcmCode[]
  cestCodes: CestCode[]
  cfopCodes: CfopCode[]
  taxSituationCodes: TaxSituationCode[]
  municipalServiceCodes: MunicipalServiceCode[]
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'

function EmptyState({ label }: { label: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
      <BookOpen className="w-8 h-8 text-gray-300" />
      <span className="text-sm font-semibold text-gray-600">Nenhum código de {label} cadastrado ainda</span>
      <p className="text-xs text-gray-400 max-w-sm">Tabela referencial nacional — populada por importação versionada. Enquanto vazia, os campos de código continuam aceitando texto livre nos documentos e itens.</p>
    </div>
  )
}

export function FiscalCodesConsultation({ activeTab, search, ncmCodes, cestCodes, cfopCodes, taxSituationCodes, municipalServiceCodes }: FiscalCodesConsultationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchText, setSearchText] = useState(search)

  function goToTab(tab: TabKey) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    params.delete('search')
    setSearchText('')
    router.push(`/fiscal/cadastros/tabelas-nacionais?${params.toString()}`)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    params.set('tab', activeTab)
    if (searchText) params.set('search', searchText)
    router.push(`/fiscal/cadastros/tabelas-nacionais?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => goToTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === tab.key ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input className={inputClass} placeholder="Buscar por código ou descrição..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer">
          <Search className="w-3.5 h-3.5" />
          Buscar
        </button>
      </form>

      {activeTab === 'ncm' && (
        ncmCodes.length === 0 ? <EmptyState label="NCM" /> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-bold"><tr><th className="px-4 py-2.5">Código</th><th className="px-4 py-2.5">Descrição</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {ncmCodes.map((c) => (<tr key={c.id}><td className="px-4 py-2 font-mono text-gray-800">{c.code}</td><td className="px-4 py-2 text-gray-600">{c.description}</td></tr>))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab === 'cest' && (
        cestCodes.length === 0 ? <EmptyState label="CEST" /> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-bold"><tr><th className="px-4 py-2.5">Código</th><th className="px-4 py-2.5">NCM</th><th className="px-4 py-2.5">Descrição</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {cestCodes.map((c) => (<tr key={c.id}><td className="px-4 py-2 font-mono text-gray-800">{c.code}</td><td className="px-4 py-2 font-mono text-gray-500">{c.ncm_code || '—'}</td><td className="px-4 py-2 text-gray-600">{c.description}</td></tr>))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab === 'cfop' && (
        cfopCodes.length === 0 ? <EmptyState label="CFOP" /> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-bold"><tr><th className="px-4 py-2.5">Código</th><th className="px-4 py-2.5">Direção</th><th className="px-4 py-2.5">Descrição</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {cfopCodes.map((c) => (<tr key={c.id}><td className="px-4 py-2 font-mono text-gray-800">{c.code}</td><td className="px-4 py-2 text-gray-500">{c.direction === 'IN' ? 'Entrada' : c.direction === 'OUT' ? 'Saída' : '—'}</td><td className="px-4 py-2 text-gray-600">{c.description}</td></tr>))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab === 'cst' && (
        taxSituationCodes.length === 0 ? <EmptyState label="CST/CSOSN" /> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-bold"><tr><th className="px-4 py-2.5">Família</th><th className="px-4 py-2.5">Código</th><th className="px-4 py-2.5">Descrição</th><th className="px-4 py-2.5">Crédito</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {taxSituationCodes.map((c) => (<tr key={c.id}><td className="px-4 py-2 font-semibold text-gray-700">{c.tax_family}</td><td className="px-4 py-2 font-mono text-gray-800">{c.code}</td><td className="px-4 py-2 text-gray-600">{c.description}</td><td className="px-4 py-2 text-gray-500">{c.credit_allowed === null ? '—' : c.credit_allowed ? 'Sim' : 'Não'}</td></tr>))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab === 'servico' && (
        municipalServiceCodes.length === 0 ? <EmptyState label="Serviço Municipal" /> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-bold"><tr><th className="px-4 py-2.5">Código LC 116</th><th className="px-4 py-2.5">Código Municipal</th><th className="px-4 py-2.5">Descrição</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {municipalServiceCodes.map((c) => (<tr key={c.id}><td className="px-4 py-2 font-mono text-gray-800">{c.national_service_code || '—'}</td><td className="px-4 py-2 font-mono text-gray-500">{c.municipal_service_code}</td><td className="px-4 py-2 text-gray-600">{c.description}</td></tr>))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
