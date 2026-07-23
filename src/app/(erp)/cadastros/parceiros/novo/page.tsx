import React from 'react'
import { PartnerForm } from '@/modules/registrations/partners/components/partner-form'
import { UserPlus } from 'lucide-react'

export default function NewPartnerPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <UserPlus className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Novo Parceiro</h2>
          <p className="text-sm text-gray-500">Cadastre um cliente, fornecedor, transportadora ou colaborador.</p>
        </div>
      </div>
      <PartnerForm />
    </div>
  )
}
