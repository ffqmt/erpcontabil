'use client'

import React, { useTransition, useState } from 'react'
import { AccountingPeriod } from '../types'
import { CurrentPeriodCard } from './current-period-card'
import { PeriodsTable } from './periods-table'
import { closeAccountingPeriodAction, reopenAccountingPeriodAction } from '../actions'
import { AlertCircle, CheckCircle, Info } from 'lucide-react'

interface PeriodsManagerProps {
  periods: AccountingPeriod[]
  currentPeriod: AccountingPeriod
  activeCompetence: string
}

export function PeriodsManager({
  periods,
  currentPeriod,
  activeCompetence
}: PeriodsManagerProps) {
  const [isPending, startTransition] = useTransition()
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Ação de fechar o período
  const handleClose = (id: string) => {
    setSuccessMsg(null)
    setErrorMsg(null)

    if (confirm('Tem certeza de que deseja FECHAR esta competência contábil? Lançamentos adicionais ou edições estarão bloqueados.')) {
      startTransition(async () => {
        const res = await closeAccountingPeriodAction({ periodId: id })
        if (res.ok) {
          setSuccessMsg(res.message || 'Competência fechada com sucesso!')
          setTimeout(() => setSuccessMsg(null), 4000)
        } else {
          setErrorMsg(res.error)
          setTimeout(() => setErrorMsg(null), 6000)
        }
      })
    }
  }

  // Ação de reabrir o período — motivo obrigatório (Etapa 30A), fica na trilha de auditoria
  const handleReopen = (id: string) => {
    setSuccessMsg(null)
    setErrorMsg(null)

    const reason = window.prompt('Informe o motivo da reabertura desta competência contábil (mínimo 10 caracteres). Este motivo fica registrado na trilha de auditoria do período.')
    if (reason === null) return // usuário cancelou

    if (reason.trim().length < 10) {
      setErrorMsg('Motivo da reabertura deve ter pelo menos 10 caracteres.')
      setTimeout(() => setErrorMsg(null), 6000)
      return
    }

    if (confirm('Tem certeza de que deseja REABRIR esta competência contábil?')) {
      startTransition(async () => {
        const res = await reopenAccountingPeriodAction({ periodId: id, reason: reason.trim() })
        if (res.ok) {
          setSuccessMsg(res.message || 'Competência reaberta com sucesso!')
          setTimeout(() => setSuccessMsg(null), 4000)
        } else {
          setErrorMsg(res.error)
          setTimeout(() => setErrorMsg(null), 6000)
        }
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Alertas Rápidos de Sucesso / Erro */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl text-xs font-semibold flex gap-2 items-center shadow-sm">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-semibold flex gap-2 items-start shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block">Falha ao Alterar Período</strong>
            <p className="font-normal text-red-700 leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Card da Competência Ativa */}
      <CurrentPeriodCard
        period={currentPeriod}
        onClosePeriod={handleClose}
        onReopenPeriod={handleReopen}
        isPending={isPending}
      />

      {/* Listagem completa com histórico */}
      <PeriodsTable
        periods={periods}
        activeCompetence={activeCompetence}
        onClosePeriod={handleClose}
        onReopenPeriod={handleReopen}
        isPending={isPending}
      />
    </div>
  )
}
