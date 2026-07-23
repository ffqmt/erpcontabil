import React from 'react'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import { listImportClassificationRules } from '@/modules/fiscal/import-classification-rules/queries'
import { RuleList } from '@/modules/fiscal/import-classification-rules/components/rule-list'
import { ListFilter, Plus, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ImportClassificationRulesPage() {
  const context = await getCurrentContext()

  let errorMsg: string | null = null
  let rules: Awaited<ReturnType<typeof listImportClassificationRules>> = []

  try {
    rules = await listImportClassificationRules(context.companyId)
  } catch (error: unknown) {
    errorMsg = error instanceof Error ? error.message : 'Falha ao carregar regras de importação XML.'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <ListFilter className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Regras de Importação XML</h2>
            <p className="text-sm text-gray-500">Aplicam Natureza Fiscal, CFOP de escrituração e CST/CSOSN automaticamente ao importar XML — condição vazia casa com tudo.</p>
          </div>
        </div>
        <Link
          href="/fiscal/configuracoes/regras-importacao/novo"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Nova Regra
        </Link>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : (
        <RuleList rules={rules} />
      )}
    </div>
  )
}
