import React from 'react'
import { getCurrentContext } from '@/lib/context/current-context'
import { listOpenReviewIssues } from '@/modules/fiscal/item-matching/queries'
import { getItemOptions } from '@/modules/registrations/items/queries'
import { ReviewIssuesQueue } from '@/modules/fiscal/item-matching/components/review-issues-queue'
import { ClipboardList, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ReviewItemsPage() {
  const context = await getCurrentContext()

  let errorMsg: string | null = null
  let issues: Awaited<ReturnType<typeof listOpenReviewIssues>> = []
  let items: Awaited<ReturnType<typeof getItemOptions>> = []

  try {
    ;[issues, items] = await Promise.all([
      listOpenReviewIssues(context.companyId),
      getItemOptions(context.companyId, { activeOnly: true })
    ])
  } catch (error: any) {
    errorMsg = error.message || 'Falha ao carregar pendências de classificação de item.'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <ClipboardList className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Revisão de Itens Importados</h2>
          <p className="text-sm text-gray-500">Itens de XML sem vínculo forte com o catálogo de produtos — vincule ou crie o produto correspondente.</p>
        </div>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : (
        <ReviewIssuesQueue issues={issues} items={items} />
      )}
    </div>
  )
}
