import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getAccountingDashboardData } from '@/modules/accounting/dashboard/queries'
import { AccountingDashboard } from '@/modules/accounting/dashboard/components/accounting-dashboard'
import { Landmark, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ContabilidadeDashboardPage() {
  const context = await getCurrentContext()
  
  let dashboardData = null
  let errorMsg = null

  try {
    dashboardData = await getAccountingDashboardData(
      context.companyId,
      context.competence,
      context.workspaceId
    )
  } catch (error: any) {
    console.error('Erro ao carregar dados do Dashboard Contábil:', error)
    errorMsg = error.message || 'Falha ao processar os indicadores e KPIs contábeis.'
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Painel de Bordo Contábil</h2>
            <p className="text-sm text-gray-500">
              Visão geral corporativa, auditoria patrimonial, monitoramento econômico e status fiscal da competência.
            </p>
          </div>
        </div>
      </div>

      {/* Trata Estado de Erro */}
      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 space-y-4 max-w-2xl">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
            <div>
              <strong className="font-semibold block mb-1">Falha na Coleta de Dados do Painel</strong>
              <p className="text-sm leading-relaxed text-red-700 font-normal">
                {errorMsg}
              </p>
              <div className="mt-4 pt-3 border-t border-red-100 text-[11px] text-red-600 space-y-1 font-medium">
                <p>Verifique se:</p>
                <p>1. O banco local do Supabase está rodando e acessível.</p>
                <p>2. Os scripts de seed do banco foram executados corretamente.</p>
                <p>3. As variáveis do arquivo <strong>.env.local</strong> estão corretas.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Renderiza o Dashboard Contábil */
        <AccountingDashboard data={dashboardData!} />
      )}
    </div>
  )
}
