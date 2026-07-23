import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { getAllJournalEntries } from '@/modules/accounting/journal/queries'
import { getAccountingPeriodStatusMap, getCurrentAccountingPeriod } from '@/modules/accounting/periods/queries'
import { getPartners } from '@/modules/registrations/partners/queries'
import { JournalManagementPanel } from '@/modules/accounting/journal/components/journal-management-panel'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { JournalEntry } from '@/modules/accounting/journal/types'
import { formatCompetenceBR, formatDateBR } from '@/modules/accounting/journal/journal-utils'
import { AlertCircle, Landmark } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ startDate?: string; endDate?: string }>
}

function lastDayOfCompetence(competence: string) {
  const competenceDate = new Date(`${competence}T00:00:00`)
  const lastDay = new Date(competenceDate.getFullYear(), competenceDate.getMonth() + 1, 0)
  return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
}

function validDateParam(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

export default async function LancamentosPage({ searchParams }: PageProps) {
  const params = await searchParams
  const context = await getCurrentContext()
  const defaultStartDate = context.competence
  const defaultEndDate = lastDayOfCompetence(context.competence)
  const requestedStartDate = validDateParam(params.startDate) || defaultStartDate
  const requestedEndDate = validDateParam(params.endDate) || defaultEndDate
  const startDate = requestedStartDate <= requestedEndDate ? requestedStartDate : requestedEndDate
  const endDate = requestedStartDate <= requestedEndDate ? requestedEndDate : requestedStartDate

  let accounts: ChartAccount[] = []
  let entries: JournalEntry[] = []
  let partners: { id: string; name: string }[] = []
  let periodStatusByCompetence: Record<string, string> = {}
  let errorMsg = null
  let isClosed = false

  try {
    // AUDITORIA (Etapa 28A): as 3 buscas independentes (período, contas, lançamentos,
    // parceiros) rodavam em sequência — nenhuma depende do resultado da outra, então
    // Promise.all reduz o tempo total de ~soma para ~máximo das 4.
    const [period, accountsResult, entriesResult, partnersResult] = await Promise.all([
      getCurrentAccountingPeriod(context.companyId, context.competence, context.workspaceId),
      getAccounts(context.companyId),
      getAllJournalEntries(context.companyId, { competence: context.competence, startDate, endDate }),
      getPartners(context.companyId)
    ])
    isClosed = period.status === 'CLOSED'
    accounts = accountsResult
    entries = entriesResult
    partners = partnersResult.map((p) => ({ id: p.id, name: p.name }))

    const competencies = Array.from(new Set([context.competence, ...entries.map((entry) => entry.competence)]))
    periodStatusByCompetence = await getAccountingPeriodStatusMap(context.companyId, competencies)
  } catch (error: unknown) {
    errorMsg = error instanceof Error ? error.message : 'Erro desconhecido ao carregar os lançamentos manuais.'
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
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Lançamentos Contábeis</h2>
            <p className="text-sm text-gray-500">Criação, listagem e efetivação de lançamentos manuais em rascunho.</p>
          </div>
        </div>
        <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 font-medium w-fit">
          Visualização: <span className="text-gray-700 font-bold">{formatDateBR(startDate)} a {formatDateBR(endDate)}</span>
        </div>
      </div>

      {/* Banner de Aviso de Período Fechado */}
      {isClosed && !errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-semibold flex gap-2.5 items-start">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-650 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <strong className="block text-sm">Período Contábil Fechado!</strong>
            <p className="font-normal text-red-700 leading-relaxed">
              A competência operacional ativa ({formatCompetenceBR(context.competence)}) encontra-se **FECHADA**.
              Lançamentos com data nessa competência serão bloqueados. Criações, postagens e estornos respeitam a competência própria da data de cada lançamento.
              Para gerenciar o status da competência, acesse o painel de <a href="/contabilidade/periodos" className="font-bold underline text-red-800 hover:text-red-950">Períodos Contábeis</a>.
            </p>
          </div>
        </div>
      )}

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
        /* Trata Estado Vazio (Sem plano de contas) */
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-2xl text-amber-900 space-y-4">
          <div className="flex gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0 text-amber-600" />
            <div>
              <strong className="font-semibold text-base block mb-1">Plano de Contas Inexistente</strong>
              <p className="text-sm leading-relaxed text-amber-800">
                Você precisa cadastrar ou inicializar as contas contábeis da empresa ativa antes de efetuar lançamentos manuais.
              </p>
            </div>
          </div>
          <div className="bg-white/80 p-4 rounded-lg border border-amber-100 text-xs text-amber-950 space-y-2">
            <span className="font-bold block">Como Inicializar os Dados Demo:</span>
            <p className="leading-relaxed">
              Rode o script de seed contábil para preencher o plano de contas e os lançamentos contábeis de teste:
            </p>
            <code className="block bg-gray-900 text-gray-200 p-2.5 rounded font-mono text-[11px] select-all">
              psql -U postgres -d seu_banco -f db/seed/seed_demo_accounting.sql
            </code>
          </div>
        </div>
      ) : (
        /* Renderiza Painel de Lançamentos */
        <JournalManagementPanel
          accounts={accounts}
          entries={entries}
          partners={partners}
          competence={context.competence}
          dateRange={{ startDate, endDate }}
          periodStatusByCompetence={periodStatusByCompetence}
          isClosed={isClosed}
        />
      )}
    </div>
  )
}
