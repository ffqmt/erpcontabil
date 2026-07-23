'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Lock, Unlock, AlertCircle, Check } from 'lucide-react'
import { setActiveCompetenceAction } from '@/lib/context/actions'

interface PeriodSelectorProps {
  competence: string
  periodStatus: 'OPEN' | 'IN_REVIEW' | 'CLOSED' | 'REOPENED' | string
}

// Antes: componente decorativo (TODO nunca implementado). Agora troca a competência ativa
// de verdade — grava o cookie current_competence via setActiveCompetenceAction, que também
// garante (autocria se preciso) o accounting_periods correspondente antes de trocar.
export function PeriodSelector({ competence, periodStatus }: PeriodSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(competence.substring(0, 7))

  const formatCompetence = (dateStr: string) => {
    if (!dateStr) return '—'
    const parts = dateStr.split('-')
    if (parts.length < 2) return dateStr
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const monthIdx = parseInt(parts[1], 10) - 1
    const year = parts[0]
    return `${months[monthIdx] || parts[1]}/${year}`
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'OPEN':
      case 'REOPENED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
            <Unlock className="w-3 h-3" /> Aberto
          </span>
        )
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
            Revisão
          </span>
        )
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
            <Lock className="w-3 h-3" /> Fechado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
            {status || 'Desconhecido'}
          </span>
        )
    }
  }

  function handleApply() {
    setError(null)
    startTransition(async () => {
      const res = await setActiveCompetenceAction(value)
      if (res.ok) {
        setIsEditing(false)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
      <div className="p-2 bg-indigo-100 text-indigo-800 rounded-md">
        <Calendar className="w-5 h-5" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Competência</span>
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="month"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isPending}
              className="text-sm font-medium text-gray-800 border border-gray-300 rounded px-1.5 py-0.5 disabled:opacity-50"
              autoFocus
            />
            <button type="button" onClick={handleApply} disabled={isPending} title="Confirmar" className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50 cursor-pointer">
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setValue(competence.substring(0, 7)); setIsEditing(true) }}
            className="flex items-center gap-2 cursor-pointer hover:opacity-75"
            title="Trocar competência ativa"
          >
            <span className="text-sm font-medium text-gray-800">
              {formatCompetence(competence)}
            </span>
            {getStatusBadge(periodStatus)}
          </button>
        )}
        {error && (
          <span className="text-[10px] text-red-600 font-semibold flex items-center gap-1 mt-0.5">
            <AlertCircle className="w-3 h-3" /> {error}
          </span>
        )}
      </div>
    </div>
  )
}
