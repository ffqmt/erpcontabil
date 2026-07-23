import React from 'react'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/context/current-context'
import { listBankStatementImports } from '@/modules/banking/queries'
import { formatDateBR } from '@/modules/banking/utils'
import { FileStack, Plus, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: 'Sucesso',
  WARNING: 'Com ressalvas',
  ERROR: 'Erro',
  PROCESSING: 'Processando'
}

const STATUS_THEME: Record<string, string> = {
  SUCCESS: 'bg-green-50 text-green-700 border-green-200',
  WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
  ERROR: 'bg-red-50 text-red-700 border-red-200',
  PROCESSING: 'bg-gray-50 text-gray-500 border-gray-200'
}

export default async function BankStatementImportsPage() {
  const context = await getCurrentContext()

  let errorMsg: string | null = null
  let imports: Awaited<ReturnType<typeof listBankStatementImports>> = []

  try {
    imports = await listBankStatementImports(context.companyId)
  } catch (error: any) {
    errorMsg = error.message || 'Falha ao carregar importações.'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <FileStack className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Extratos Importados</h2>
            <p className="text-sm text-gray-500">Histórico de lotes de importação de extrato bancário.</p>
          </div>
        </div>
        <Link
          href="/bancos/importar"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Nova Importação
        </Link>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : imports.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
          <FileStack className="w-8 h-8 text-gray-300" />
          <span className="text-sm font-semibold text-gray-600">Nenhuma importação realizada ainda</span>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Data</th>
                <th className="text-left px-4 py-3 font-semibold">Arquivo</th>
                <th className="text-left px-4 py-3 font-semibold">Conta</th>
                <th className="text-center px-4 py-3 font-semibold">Válidas</th>
                <th className="text-center px-4 py-3 font-semibold">Inválidas</th>
                <th className="text-center px-4 py-3 font-semibold">Duplicadas</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {imports.map((imp) => (
                <tr key={imp.id}>
                  <td className="px-4 py-2.5 text-gray-500 font-mono">{formatDateBR(imp.created_at.substring(0, 10))}</td>
                  <td className="px-4 py-2.5 text-gray-700">{imp.file_name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{imp.bank_account?.bank_name || '—'}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-green-700">{imp.valid_lines}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-red-600">{imp.invalid_lines}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-amber-600">{imp.duplicate_lines}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${STATUS_THEME[imp.status] || STATUS_THEME.PROCESSING}`}>
                      {STATUS_LABEL[imp.status] || imp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
