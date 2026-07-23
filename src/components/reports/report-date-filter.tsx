'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, Filter, RotateCcw } from 'lucide-react'

interface ReportDateFilterProps {
  defaultStartDate: string
  defaultEndDate: string
}

export function ReportDateFilter({
  defaultStartDate,
  defaultEndDate
}: ReportDateFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [startDate, setStartDate] = useState(
    searchParams.get('startDate') || defaultStartDate
  )
  const [endDate, setEndDate] = useState(
    searchParams.get('endDate') || defaultEndDate
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleFilter(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    if (!startDate || !endDate) {
      setValidationError('Ambas as datas inicial e final são obrigatórias.')
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      setValidationError('A data inicial não pode ser maior que a data final.')
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('startDate', startDate)
    params.set('endDate', endDate)
    router.push(`?${params.toString()}`)
  }

  function handleClear() {
    setStartDate(defaultStartDate)
    setEndDate(defaultEndDate)
    setValidationError(null)
    
    const params = new URLSearchParams(searchParams.toString())
    params.delete('startDate')
    params.delete('endDate')
    
    const queryString = params.toString()
    router.push(queryString ? `?${queryString}` : '?')
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm print:hidden">
      <form onSubmit={handleFilter} className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Data Inicial
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Data Final
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Filter className="w-4 h-4" />
            Filtrar
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Limpar
          </button>
        </div>
      </form>

      {validationError && (
        <p className="text-xs text-red-650 font-semibold mt-2">{validationError}</p>
      )}
    </div>
  )
}
