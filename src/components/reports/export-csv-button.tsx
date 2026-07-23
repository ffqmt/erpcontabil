'use client'

import React from 'react'
import { Download } from 'lucide-react'
import { buildCsv, downloadCsv, CsvFieldType } from '@/lib/csv/export-csv'

interface ExportCsvButtonProps {
  filename: string
  rows: Record<string, CsvFieldType>[]
  headers: { key: string; label: string }[]
}

export function ExportCsvButton({
  filename,
  rows,
  headers
}: ExportCsvButtonProps) {
  const handleExport = () => {
    if (rows.length === 0) {
      alert('Nenhum dado disponível para exportação.')
      return
    }
    
    try {
      const csvContent = buildCsv(rows, headers)
      downloadCsv(filename, csvContent)
    } catch (err: any) {
      console.error('Falha ao exportar CSV:', err)
      alert('Falha interna ao gerar o arquivo CSV.')
    }
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all cursor-pointer print:hidden select-none hover:scale-102 active:scale-98"
    >
      <Download className="w-4 h-4" />
      Exportar CSV
    </button>
  )
}
