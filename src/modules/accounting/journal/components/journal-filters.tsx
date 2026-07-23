'use client'

import React, { useState, useEffect } from 'react'
import { Search, RotateCcw } from 'lucide-react'

export interface JournalFilterState {
  search: string
  origin: string
  startDate: string
  endDate: string
}

interface JournalFiltersProps {
  onFilterChange: (filters: JournalFilterState) => void
}

export function JournalFilters({ onFilterChange }: JournalFiltersProps) {
  const [filters, setFilters] = useState<JournalFilterState>({
    search: '',
    origin: '',
    startDate: '',
    endDate: ''
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

  const handleReset = () => {
    setFilters({
      search: '',
      origin: '',
      startDate: '',
      endDate: ''
    })
  }

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Filtros de Lançamentos
        </h3>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 transition-colors font-medium"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Limpar filtros
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Pesquisa Geral */}
        <div className="relative">
          <input
            type="text"
            name="search"
            value={filters.search}
            onChange={handleInputChange}
            placeholder="Nº, histórico, conta..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50/50 text-gray-900"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
        </div>

        {/* Origem do Lançamento */}
        <div>
          <select
            name="origin"
            value={filters.origin}
            onChange={handleInputChange}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50/50 text-gray-900"
          >
            <option value="">Origem: Todas</option>
            <option value="MANUAL">Manual</option>
            <option value="OPENING">Abertura</option>
            <option value="FISCAL_DOCUMENT">Documento Fiscal</option>
            <option value="PAYROLL_SUMMARY">Resumo da Folha</option>
            <option value="PAYROLL_PAYMENT">Pagamento da Folha</option>
            <option value="RESULT_CLOSING">Encerramento</option>
            <option value="REVERSAL">Estornos</option>
          </select>
        </div>

        {/* Data Inicial */}
        <div>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleInputChange}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50/50 text-gray-700"
          />
        </div>

        {/* Data Final */}
        <div>
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleInputChange}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50/50 text-gray-700"
          />
        </div>
      </div>
    </div>
  )
}
