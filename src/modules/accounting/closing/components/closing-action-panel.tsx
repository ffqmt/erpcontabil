'use client'

import React, { useState, useTransition } from 'react'
import { ClosingStatus } from '../types'
import { closeIncomeStatementAction } from '../actions'
import { CheckCircle, AlertTriangle, AlertCircle, BookmarkCheck, Play, Info } from 'lucide-react'

interface ClosingActionPanelProps {
  status: ClosingStatus
  competence: string
}

export function ClosingActionPanel({
  status,
  competence
}: ClosingActionPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    periodStatus,
    hasDrafts,
    hasClosing,
    equityResultAccount
  } = status

  const isPeriodOpen = periodStatus === 'OPEN' || periodStatus === 'REOPENED'
  const isTargetFound = !!equityResultAccount

  // Condição para habilitar o encerramento contábil
  const canExecute = isPeriodOpen && !hasDrafts && !hasClosing && isTargetFound

  const handleExecute = () => {
    if (!canExecute || !confirm) return
    setSuccessMsg(null)
    setErrorMsg(null)

    if (window.confirm('Tem certeza de que deseja executar o ENCERRAMENTO de resultado para esta competência? Um lançamento contábil oficial balanceado será postado no livro diário.')) {
      startTransition(async () => {
        const res = await closeIncomeStatementAction({
          equityResultAccountId: equityResultAccount!.id,
          confirm
        })

        if (res.ok) {
          setSuccessMsg(res.message || 'Resultado encerrado com sucesso!')
          setConfirm(false)
        } else {
          setErrorMsg(res.error)
        }
      })
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
      <h3 className="text-sm font-bold text-gray-750 uppercase tracking-wider flex items-center gap-2">
        <BookmarkCheck className="w-5 h-5 text-gray-400" />
        Painel de Execução
      </h3>

      {/* Mensagens de Sucesso ou Erro */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg text-xs font-semibold flex gap-2 items-center">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-650 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-0.5">Falha ao Realizar Encerramento</strong>
            <p className="font-normal text-red-700 leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Bloco de Avisos / Instruções */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg space-y-3 text-xs text-gray-600">
        <div className="flex gap-2 items-start">
          <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <span className="font-bold text-gray-700 block">Informações sobre o Lançamento de Encerramento:</span>
            <p>1. O encerramento de resultado gera um lançamento contábil real de origem <strong>RESULT_CLOSING</strong> no livro diário.</p>
            <p>2. Os saldos acumulados de receitas, deduções, custos e despesas na competência são zerados fisicamente.</p>
            <p>3. O lucro ou prejuízo do período é transferido automaticamente como contrapartida para a conta de PL: <strong>{equityResultAccount ? `${equityResultAccount.code} - ${equityResultAccount.name}` : '(Nenhuma conta candidata encontrada no PL)'}</strong>.</p>
            <p>4. Caso necessite reverter a ação, você poderá estornar este lançamento na tela de Lançamentos Contábeis.</p>
          </div>
        </div>
      </div>

      {/* Seleção de Conta / Checkbox de Confirmação */}
      {canExecute ? (
        <div className="space-y-4 border-t border-gray-150 pt-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500">Conta de Destino no PL:</span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded font-mono text-xs font-bold border border-emerald-100">
              {equityResultAccount?.code} - {equityResultAccount?.name}
            </span>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              disabled={isPending}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs font-medium text-gray-700 leading-normal">
              Confirmo que revisei a prévia e autorizo o sistema a postar o lançamento de zeramento de resultado para a competência ativa ({competence}).
            </span>
          </label>

          <button
            onClick={handleExecute}
            disabled={!confirm || isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-650 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed hover:scale-101 active:scale-99"
          >
            <Play className="w-4 h-4 fill-current" />
            {isPending ? 'Executando Encerramento...' : 'Gerar Lançamento de Encerramento'}
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-2.5 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-amber-850">
            <strong className="block font-semibold">Encerramento Contábil Indisponível</strong>
            <p className="leading-relaxed font-normal">
              {!isPeriodOpen && 'O período contábil correspondente a este mês encontra-se trancado/fechado.'}
              {hasDrafts && `Existem ${status.draftsCount} rascunho(s) pendente(s) na competência. Cancele, exclua ou publique todos antes de encerrar.`}
              {hasClosing && `Esta competência já foi encerrada fisicamente por meio de um lançamento contábil de encerramento.`}
              {!isTargetFound && 'Não foi encontrada nenhuma conta contábil analítica ativa do Patrimônio Líquido (EQUITY) para receber o resultado. Cadastre uma conta de Lucros/Prejuízos no plano de contas.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
