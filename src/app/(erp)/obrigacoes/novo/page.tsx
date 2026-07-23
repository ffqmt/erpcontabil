import React from 'react'
import { ObligationForm } from '@/modules/obligations/components/obligation-form'
import { FilePlus } from 'lucide-react'

export default function NewObligationPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <FilePlus className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Nova Obrigação</h2>
          <p className="text-sm text-gray-500">Guia ou declaração cadastrada manualmente.</p>
        </div>
      </div>
      <ObligationForm />
    </div>
  )
}
