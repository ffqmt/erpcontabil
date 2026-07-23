'use client'

import React, { useState, useEffect } from 'react'
import { Search, RotateCcw } from 'lucide-react'

export interface TrialFilterState {
  search: string
  type: string
  isSynthetic: string
  hideZeroBalances: boolean
}

interface TrialBalanceFiltersProps {
  onFilterChange: (filters: TrialFilterState) => void
}

export function TrialBalanceFilters({ onFilterChange }: TrialBalanceFiltersProps) {
  const [filters, setFilters] = useState<TrialFilterState>({
    search: '',
    type: '',
    isSynthetic: '',
    hideZeroBalances: true // Por padrão, ocultamos as contas totalmente zeradas
  })

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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setFilters((prev) => ({
      ...prev,
      [name]: checked
    }))
  }

  const handleReset = () => {
    setFilters({
      search: '',
      type: '',
      isSynthetic: '',
      hideZeroBalances: false
    })
  }

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Filtros de Pesquisa</h3>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 transition-colors font-medium"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Limpar filtros
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
        {/* Busca por código ou nome */}
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

        {/* Tipo de conta */}
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

        {/* Tipo Estrutural */}
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

        {/* Ocultar zeradas */}
        <div className="flex items-center gap-2 pl-2">
          <input
            type="checkbox"
            name="hideZeroBalances"
            id="hideZeroBalances"
            checked={filters.hideZeroBalances}
            onChange={handleCheckboxChange}
            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
          />
          <label htmlFor="hideZeroBalances" className="text-xs font-semibold text-gray-600 select-none cursor-pointer">
            Ocultar contas zeradas
          </label>
        </div>
      </div>
    </div>
  )
}
