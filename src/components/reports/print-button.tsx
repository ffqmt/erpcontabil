'use client'

import React from 'react'
import { Printer } from 'lucide-react'

export function PrintButton() {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <button
      onClick={handlePrint}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-xs rounded-lg shadow-sm transition-all cursor-pointer print:hidden select-none hover:scale-102 active:scale-98"
    >
      <Printer className="w-4 h-4" />
      Imprimir Relatório
    </button>
  )
}
