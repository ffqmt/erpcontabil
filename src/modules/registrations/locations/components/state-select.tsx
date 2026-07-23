'use client'

import React from 'react'

// Lista estática das 27 UFs brasileiras — referência nacional fixa, não depende do
// catálogo `states` no banco (que hoje tem apenas as 10 UFs seedadas na Etapa 15).
const BRAZILIAN_STATES: { uf: string; name: string }[] = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' }, { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' }, { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' }, { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' }, { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' }, { uf: 'RN', name: 'Rio Grande do Norte' }, { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' }, { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' }, { uf: 'TO', name: 'Tocantins' }
]

interface StateSelectProps {
  value: string
  onChange: (uf: string) => void
}

export function StateSelect({ value, onChange }: StateSelectProps) {
  return (
    <select
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— Selecione —</option>
      {BRAZILIAN_STATES.map((s) => (
        <option key={s.uf} value={s.uf}>
          {s.uf} — {s.name}
        </option>
      ))}
    </select>
  )
}
