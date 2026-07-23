import React from 'react'
import { FiscalNatureForm } from '@/modules/registrations/fiscal-natures/components/fiscal-nature-form'
import { FileStack } from 'lucide-react'

export default function NewFiscalNaturePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <FileStack className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Nova Natureza Fiscal</h2>
          <p className="text-sm text-gray-500">Cadastre uma natureza de operação para uso futuro pelo módulo Fiscal.</p>
        </div>
      </div>
      <FiscalNatureForm />
    </div>
  )
}
