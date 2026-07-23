import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getClosingStatus, getClosingPreview } from '@/modules/accounting/closing/queries'
import { ClosingStatusCard } from '@/modules/accounting/closing/components/closing-status-card'
import { ClosingSummary } from '@/modules/accounting/closing/components/closing-summary'
import { ClosingPreviewTable } from '@/modules/accounting/closing/components/closing-preview-table'
import { ClosingActionPanel } from '@/modules/accounting/closing/components/closing-action-panel'
import { formatCompetenceBR } from '@/modules/accounting/closing/closing-utils'
import { AlertCircle, Bookmark, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EncerramentoPage() {
  const context = await getCurrentContext()
  
  let status = null
  let preview = null
  let errorMsg = null

  try {
    // 1. Busca status geral de encerramento
    status = await getClosingStatus(context.companyId, context.competence)
    
    // 2. Busca prévia de zeramento com base na conta contábil de destino encontrada (se houver)
    const targetAccountId = status.equityResultAccount?.id || null
    preview = await getClosingPreview(context.companyId, context.competence, targetAccountId)
  } catch (error: any) {
    errorMsg = error.message || 'Falha ao processar a prévia do encerramento contábil.'
  }

  const competenceStr = formatCompetenceBR(context.competence)

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
            <Bookmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Encerramento de Resultado</h2>
            <p className="text-sm text-gray-500">Apuração final e transferência do lucro/prejuízo contábil da competência para o Patrimônio Líquido.</p>
          </div>
        </div>
        <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 font-medium w-fit">
          Competência Fiscal: <span className="text-gray-700 font-bold">{competenceStr}</span>
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
        </div>
      ) : (
        /* Renderiza Painéis Operacionais */
        <div className="space-y-6">
          {/* Card Geral de Status do Período */}
          <ClosingStatusCard status={status!} activeCompetence={context.competence} />

          {/* Se já foi encerrado, exibe banner verde e oculta o painel de ação e a prévia do diário */}
          {status!.hasClosing ? (
            <div className="bg-green-50 border border-green-200 text-green-950 p-6 rounded-xl space-y-3 max-w-3xl shadow-sm">
              <div className="flex gap-3">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-bold text-base text-green-900 mb-1">Competência Encerrada Fisicamente!</h3>
                  <p className="text-sm leading-relaxed text-green-800">
                    O encerramento de resultado deste mês ({competenceStr}) foi realizado com sucesso. 
                    As contas temporárias de receita e despesas estão com saldo físico igual a zero no diário contábil e balancete.
                  </p>
                  <p className="text-xs text-green-700 mt-2 font-medium">
                    O lançamento oficial correspondente possui o status de publicado. Caso necessite efetuar ajustes, 
                    faça o estorno do lançamento na tela de <a href="/contabilidade/lancamentos" className="underline font-bold text-green-900 hover:text-green-950">Lançamentos Contábeis</a>.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Layout de Encerramento Pendente */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Coluna Esquerda (2/3): Resumos e Prévia do Diário */}
              <div className="lg:col-span-2 space-y-6">
                {/* Resumo Contábil do Resultado */}
                <ClosingSummary
                  totalRevenue={preview!.totalRevenue}
                  totalDeductions={preview!.totalDeductions}
                  totalCosts={preview!.totalCosts}
                  totalExpenses={preview!.totalExpenses}
                  netResult={preview!.netResult}
                />

                {/* Tabela de Prévia do Lançamento de Zeramento */}
                <ClosingPreviewTable
                  items={preview!.items}
                  targetAccountName={status!.equityResultAccount?.name}
                  netResult={preview!.netResult}
                />
              </div>

              {/* Coluna Direita (1/3): Painel de Ação de Encerramento */}
              <div>
                <ClosingActionPanel status={status!} competence={competenceStr} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
