'use client'

import React, { useState, useEffect } from 'react'
import { AccountType, NormalBalance } from '../types'
import { Search, RotateCcw } from 'lucide-react'

export interface FilterState {
  search: string
  type: string
  balance: string
  isSynthetic: string
  status: string
}

interface AccountFiltersProps {
  onFilterChange: (filters: FilterState) => void
}

export function AccountFilters({ onFilterChange }: AccountFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    type: '',
    balance: '',
    isSynthetic: '',
    status: ''
  })

  // Dispara a atualização dos filtros sempre que houver alteração
  useEffect(() => {
    onFilterChange(filters)
  }, [filters, onFilterChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFilters((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const handleReset = () => {
    setFilters({
      search: '',
      type: '',
      balance: '',
      isSynthetic: '',
      status: ''
    })
  }

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          Filtros de Pesquisa
        </h3>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 transition-colors font-medium"
          title="Limpar Filtros"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Limpar filtros
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Busca por Código/Nome */}
        <div className="relative">
          <input
            type="text"
            name="search"
            value={filters.search}
            onChange={handleInputChange}
            placeholder="Buscar por código ou nome..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50/50 text-gray-900"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
        </div>

        {/* Tipo da Conta */}
        <div>
          <select
            name="type"
            value={filters.type}
            onChange={handleInputChange}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50/50 text-gray-900"
          >
            <option value="">Tipo: Todos</option>
            <option value="ASSET">Ativo</option>
            <option value="LIABILITY">Passivo</option>
            <option value="EQUITY">Patrimônio Líquido</option>
            <option value="REVENUE">Receita</option>
            <option value="REVENUE_DEDUCTION">Dedução da Receita</option>
            <option value="COST">Custo</option>
            <option value="EXPENSE">Despesa</option>
          </select>
        </div>

        {/* Natureza */}
        <div>
          <select
            name="balance"
            value={filters.balance}
            onChange={handleInputChange}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50/50 text-gray-900"
          >
            <option value="">Natureza: Todas</option>
            <option value="DEBIT">Devedora (D)</option>
            <option value="CREDIT">Credora (C)</option>
          </select>
        </div>

        {/* Tipo Estrutural (Sintética / Analítica) */}
        <div>
          <select
            name="isSynthetic"
            value={filters.isSynthetic}
            onChange={handleInputChange}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50/50 text-gray-900"
          >
            <option value="">Estrutura: Todas</option>
            <option value="true">Apenas Sintéticas</option>
            <option value="false">Apenas Analíticas</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <select
            name="status"
            value={filters.status}
            onChange={handleInputChange}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50/50 text-gray-900"
          >
            <option value="">Status: Todos</option>
            <option value="true">Apenas Ativas</option>
            <option value="false">Apenas Inativas</option>
          </select>
        </div>
      </div>
    </div>
  )
}
