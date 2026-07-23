import React from 'react'
import { Partner } from '../types'
import { PartnerCard } from './partner-card'
import { Users } from 'lucide-react'

interface PartnerListProps {
  partners: Partner[]
}

export function PartnerList({ partners }: PartnerListProps) {
  if (partners.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <Users className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhum parceiro cadastrado</span>
        <p className="text-xs text-gray-400 max-w-xs">Clique em "Novo Parceiro" para cadastrar clientes, fornecedores, transportadoras ou colaboradores.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {partners.map((partner) => (
        <PartnerCard key={partner.id} partner={partner} />
      ))}
    </div>
  )
}
