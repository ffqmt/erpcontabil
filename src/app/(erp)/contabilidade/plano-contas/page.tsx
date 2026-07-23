import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { AccountsTable } from '@/modules/accounting/accounts/components/accounts-table'
import { AlertCircle, HelpCircle, RefreshCcw } from 'lucide-react'

// Força renderização dinâmica para carregar o contexto correto por requisição
export const dynamic = 'force-dynamic'

export default async function PlanoContasPage() {
  const context = await getCurrentContext()
  
  let accounts: ChartAccount[] = []
  let errorMsg = null

  try {
    accounts = await getAccounts(context.companyId)
  } catch (error: any) {
    errorMsg = error.message || 'Erro desconhecido ao carregar o plano de contas.'
  }

  // Helper para formatar a data da competência (ex: 2025-01-01 -> Jan/2025)
  const formatCompetence = (dateStr: string) => {
    if (!dateStr) return '—'
    const parts = dateStr.split('-')
    if (parts.length < 2) return dateStr
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const monthIdx = parseInt(parts[1], 10) - 1
    const year = parts[0]
    return `${months[monthIdx] || parts[1]}/${year}`
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Plano de Contas</h2>
          <p className="text-sm text-gray-500">Estrutura contábil e classificação de contas da empresa ativa.</p>
        </div>
        <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 font-medium w-fit">
          Competência Operacional: <span className="text-gray-700 font-bold">{formatCompetence(context.competence)}</span>
        </div>
      </div>

      {/* Trata Estado de Erro */}
      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 space-y-4 max-w-2xl">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
            <div>
              <strong className="font-semibold block mb-1">Falha ao Conectar ao Banco de Dados</strong>
              <p className="text-sm leading-relaxed text-red-700">{errorMsg}</p>
            </div>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border border-red-100 text-xs text-red-950 font-mono space-y-1">
            <div>DICA DE DESENVOLVEDOR:</div>
            <div>1. Certifique-se de que o arquivo `.env.local` existe na raiz do projeto Next.js.</div>
            <div>2. Verifique se as variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão populadas.</div>
            <div>3. Verifique se o schema database e RLS local/remoto estão devidamente aplicados.</div>
          </div>
        </div>
      ) : accounts.length === 0 ? (
        /* Trata Estado Vazio (Empty State) */
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-2xl text-amber-900 space-y-4">
          <div className="flex gap-3">
            <HelpCircle className="w-6 h-6 flex-shrink-0 text-amber-600" />
            <div>
              <strong className="font-semibold text-base block mb-1">Nenhuma Conta Contábil Encontrada</strong>
              <p className="text-sm leading-relaxed text-amber-800">
                A empresa ativa ({context.companyId}) não possui contas configuradas no plano de contas.
              </p>
            </div>
          </div>
          
          <div className="bg-white/80 p-4 rounded-lg border border-amber-100 text-xs text-amber-950 space-y-2">
            <span className="font-bold block">Como Inicializar os Dados Demo:</span>
            <p className="leading-relaxed">
              Execute o script de seed contábil para preencher o plano de contas de transporte em regime de Lucro Real executando o arquivo:
            </p>
            <code className="block bg-gray-900 text-gray-200 p-2.5 rounded font-mono text-[11px] select-all">
              psql -U postgres -d seu_banco -f db/seed/seed_demo_accounting.sql
            </code>
            <p className="leading-relaxed text-[11px] text-gray-500">
              Ou copie e rode o conteúdo de `db/seed/seed_demo_accounting.sql` diretamente no editor SQL do console do Supabase.
            </p>
          </div>
        </div>
      ) : (
        /* Renderiza Tabela e Componentes do Módulo */
        <AccountsTable accounts={accounts} />
      )}
    </div>
  )
}
