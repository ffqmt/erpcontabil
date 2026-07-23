import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getAccountingPeriods, getCurrentAccountingPeriod } from '@/modules/accounting/periods/queries'
import { PeriodsManager } from '@/modules/accounting/periods/components/periods-manager'
import { AlertCircle, Lock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PeriodosPage() {
  const context = await getCurrentContext()
  
  let periods: any[] = []
  let currentPeriod = null
  let errorMsg = null

  try {
    // 1. Busca e autocria o período para a competência ativa caso não exista
    currentPeriod = await getCurrentAccountingPeriod(
      context.companyId,
      context.competence,
      context.workspaceId
    )

    // 2. Busca o histórico de períodos contábeis
    periods = await getAccountingPeriods(context.companyId)
  } catch (error: any) {
    errorMsg = error.message || 'Falha ao conectar com o banco de dados dos períodos contábeis.'
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-red-700 rounded-lg border border-red-100">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Períodos Contábeis</h2>
            <p className="text-sm text-gray-500">Controle cronológico de abertura, fechamento e revisão das competências operacionais.</p>
          </div>
        </div>
      </div>

      {/* Trata Estado de Erro */}
      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 space-y-4 max-w-2xl">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
            <div>
              <strong className="font-semibold block mb-1">Falha de Banco de Dados</strong>
              <p className="text-sm leading-relaxed text-red-700">{errorMsg}</p>
            </div>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border border-red-100 text-xs text-red-950 font-mono space-y-1">
            <div>DICA DE SETUP:</div>
            <div>1. Verifique se o schema database e RLS local/remoto estão aplicados.</div>
            <div>2. Certifique-se de que a tabela `accounting_periods` existe e possui permissões corretas.</div>
          </div>
        </div>
      ) : periods.length === 0 ? (
        /* Empty State */
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-2xl text-amber-900 space-y-4">
          <div className="flex gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0 text-amber-600" />
            <div>
              <strong className="font-semibold text-base block mb-1">Sem períodos contábeis cadastrados</strong>
              <p className="text-sm leading-relaxed text-amber-850">
                Não localizamos nenhum período para esta empresa. O sistema tentou efetuar a autocriação da competência ativa ({context.competence}) mas não obteve registros na listagem.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Renderiza Controlador */
        <PeriodsManager
          periods={periods}
          currentPeriod={currentPeriod!}
          activeCompetence={context.competence}
        />
      )}
    </div>
  )
}
