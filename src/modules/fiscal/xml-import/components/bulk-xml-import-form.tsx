'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { bulkImportFiscalXmlAction } from '../actions'
import { BulkImportResultItem } from '../types'
import { AlertCircle, CheckCircle, FileWarning, XCircle, FolderUp } from 'lucide-react'

function formatCurrencyBRL(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'utf-8')
  })
}

const STATUS_META: Record<BulkImportResultItem['status'], { label: string; className: string; icon: React.ReactNode }> = {
  IMPORTED: { label: 'Importado', className: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  BLOCKED: { label: 'Bloqueado', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: <FileWarning className="w-3.5 h-3.5" /> },
  ERROR: { label: 'Erro', className: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-3.5 h-3.5" /> }
}

export function BulkXmlImportForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [files, setFiles] = useState<File[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [results, setResults] = useState<BulkImportResultItem[] | null>(null)

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || [])
    setFiles(selected)
    setResults(null)
    setErrorMsg(null)
  }

  function handleImport() {
    if (files.length === 0) return
    setErrorMsg(null)
    setResults(null)
    startTransition(async () => {
      try {
        const payload = await Promise.all(
          files.map(async (file) => ({ fileName: file.name, xmlText: await readFileAsText(file) }))
        )
        const res = await bulkImportFiscalXmlAction({ files: payload })
        if (res.ok) {
          setResults(res.data)
          router.refresh()
        } else {
          setErrorMsg(res.error)
        }
      } catch (e: any) {
        setErrorMsg(e?.message || 'Falha ao ler os arquivos selecionados.')
      }
    })
  }

  const importedCount = results?.filter((r) => r.status === 'IMPORTED').length ?? 0
  const blockedCount = results?.filter((r) => r.status === 'BLOCKED').length ?? 0
  const errorCount = results?.filter((r) => r.status === 'ERROR').length ?? 0

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Importar Vários XMLs Fiscais</h3>
        <p className="text-xs text-gray-500">
          Selecione até 30 arquivos XML de NF-e, CT-e ou NFS-e. Cada um é validado individualmente — os que não tiverem
          pendência (chave duplicada, CNPJ divergente, campo obrigatório ausente) são importados automaticamente,
          sem tela de revisão manual. Os que tiverem pendência não são gravados; corrija-os pelo modo
          &quot;1 arquivo&quot; acima, que permite revisar antes de confirmar.
        </p>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Arquivos XML</label>
          <input
            type="file"
            accept=".xml,text/xml"
            multiple
            onChange={handleFilesChange}
            className="text-xs text-gray-600"
          />
          {files.length > 0 && (
            <p className="text-[11px] text-gray-400 mt-1">{files.length} arquivo(s) selecionado(s).</p>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleImport}
            disabled={isPending || files.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
          >
            <FolderUp className="w-4 h-4" />
            {isPending ? 'Importando...' : `Importar ${files.length || ''} arquivo(s)`}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {results && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Resultado do Lote</h3>
            <div className="flex gap-2 text-[11px] font-semibold">
              <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">{importedCount} importado(s)</span>
              {blockedCount > 0 && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">{blockedCount} bloqueado(s)</span>}
              {errorCount > 0 && <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{errorCount} com erro</span>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-100">
                  <th className="py-1.5 pr-2">Arquivo</th>
                  <th className="py-1.5 pr-2">Status</th>
                  <th className="py-1.5 pr-2">Fornecedor/Cliente</th>
                  <th className="py-1.5 pr-2 text-right">Valor</th>
                  <th className="py-1.5 pr-2">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const meta = STATUS_META[r.status]
                  return (
                    <tr key={i} className="border-b border-gray-50 align-top">
                      <td className="py-2 pr-2 font-mono text-[11px]">{r.fileName}</td>
                      <td className="py-2 pr-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold ${meta.className}`}>
                          {meta.icon}
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2 pr-2">{r.supplierName || '—'}</td>
                      <td className="py-2 pr-2 text-right font-mono">{formatCurrencyBRL(r.documentAmount)}</td>
                      <td className="py-2 pr-2">
                        {r.status === 'IMPORTED' && r.fiscalDocumentId ? (
                          <Link href={`/fiscal/documentos/${r.fiscalDocumentId}`} className="text-emerald-700 hover:underline font-semibold">
                            Ver documento
                          </Link>
                        ) : (
                          <ul className="space-y-0.5">
                            {(r.reasons || []).map((reason, j) => (
                              <li key={j} className="text-gray-500">• {reason}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
