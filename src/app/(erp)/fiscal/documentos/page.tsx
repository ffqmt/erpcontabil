import React from 'react'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import { listFiscalDocuments } from '@/modules/fiscal/queries'
import { FiscalDocumentList } from '@/modules/fiscal/components/fiscal-document-list'
import { FileStack, Plus, FileUp, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    direction?: string
    status?: string
    text?: string
    hasPendencies?: string
    notAccounted?: string
    notAssessed?: string
    noProduct?: string
    hasXmlWarnings?: string
  }>
}

export default async function FiscalDocumentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const context = await getCurrentContext()
  const filterKey = JSON.stringify(params)

  let errorMsg: string | null = null
  let documents: Awaited<ReturnType<typeof listFiscalDocuments>> = []

  try {
    documents = await listFiscalDocuments(context.companyId, {
      direction: params.direction,
      status: params.status,
      text: params.text,
      hasPendencies: params.hasPendencies === '1',
      notAccounted: params.notAccounted === '1',
      notAssessed: params.notAssessed === '1',
      noProduct: params.noProduct === '1',
      hasXmlWarnings: params.hasXmlWarnings === '1'
    })
  } catch (error: unknown) {
    errorMsg = error instanceof Error ? error.message : 'Falha ao carregar documentos fiscais.'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <FileStack className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Documentos Fiscais</h2>
            <p className="text-sm text-gray-500">Entradas, saídas, serviços tomados e prestados.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/fiscal/importar-xml" className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 font-semibold text-sm rounded-lg transition-all">
            <FileUp className="w-4 h-4" />
            Importar XML
          </Link>
          <Link href="/fiscal/documentos/novo" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all">
            <Plus className="w-4 h-4" />
            Novo Documento
          </Link>
        </div>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : (
        <FiscalDocumentList key={filterKey} documents={documents} />
      )}
    </div>
  )
}
