'use client'

import React, { useEffect, useState } from 'react'
import { Municipality } from '../types'

interface MunicipalitySelectProps {
  uf: string
  value: string
  onChange: (name: string) => void
}

/**
 * Sugestão de município a partir do catálogo de referência (apenas 10 municípios
 * seedados na Etapa 15 — ver db/seed/seed_demo_base_registrations.sql). Não é obrigatório
 * usar este seletor: o campo de destino (ex.: partners.city) continua texto livre.
 */
export function MunicipalitySelect({ uf, value, onChange }: MunicipalitySelectProps) {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!uf) {
      setMunicipalities([])
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/locations/municipalities?uf=${encodeURIComponent(uf)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMunicipalities(data.municipalities || [])
      })
      .catch(() => {
        if (!cancelled) setMunicipalities([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [uf])

  return (
    <div className="space-y-1">
      <input
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite ou selecione uma sugestão abaixo"
        list="municipality-suggestions"
        disabled={!uf}
      />
      <datalist id="municipality-suggestions">
        {municipalities.map((m) => (
          <option key={m.id} value={m.name} />
        ))}
      </datalist>
      {uf && loading && <span className="text-[10px] text-gray-400">Carregando sugestões de {uf}...</span>}
    </div>
  )
}
