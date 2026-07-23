'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, FileText, Upload } from 'lucide-react'
import { importEsocialXmlAction } from '../actions'

interface ImportResult {
  fileName: string
  ok: boolean
  message: string
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

export function EsocialImportForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [files, setFiles] = useState<File[]>([])
  const [xmlText, setXmlText] = useState('')
  const [results, setResults] = useState<ImportResult[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files || []))
    setResults([])
    setErrorMsg(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setResults([])

    if (files.length === 0 && !xmlText.trim()) {
      setErrorMsg('Selecione ao menos um XML ou cole o conteúdo do evento eSocial.')
      return
    }

    startTransition(async () => {
      const nextResults: ImportResult[] = []

      if (files.length > 0) {
        for (const file of files) {
          const text = await file.text()
          const res = await importEsocialXmlAction({ fileName: file.name, xmlText: text })
          nextResults.push({
            fileName: file.name,
            ok: res.ok,
            message: res.ok ? res.message || 'Evento importado.' : res.error
          })
        }
      } else {
        const res = await importEsocialXmlAction({ fileName: 'xml-colado-esocial.xml', xmlText })
        nextResults.push({
          fileName: 'XML colado',
          ok: res.ok,
          message: res.ok ? res.message || 'Evento importado.' : res.error
        })
      }

      setResults(nextResults)
      if (nextResults.some((result) => result.ok)) {
        setXmlText('')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <label className={labelClass}>Arquivos XML do eSocial</label>
          <input type="file" accept=".xml,text/xml,application/xml" multiple onChange={handleFileChange} className="text-xs text-gray-600" />
          {files.length > 0 && (
            <p className="mt-1 text-[11px] text-gray-400">{files.length} arquivo(s) selecionado(s)</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Conteúdo XML</label>
          <textarea
            className={`${inputClass} font-mono text-xs`}
            rows={12}
            value={xmlText}
            onChange={(e) => setXmlText(e.target.value)}
            placeholder="<eSocial>...</eSocial>"
          />
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500 flex gap-2">
          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <span>Eventos com ID já importado serão registrados como duplicidade e não criarão novo evento de folha.</span>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {results.map((result) => (
            <div key={result.fileName} className="p-3 border-b last:border-b-0 border-gray-100 flex gap-2 items-start text-xs">
              {result.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold text-gray-800">{result.fileName}</p>
                <p className={result.ok ? 'text-emerald-700' : 'text-red-700'}>{result.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push('/folha')} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 cursor-pointer">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 cursor-pointer">
          <Upload className="w-4 h-4" />
          {isPending ? 'Importando...' : 'Importar eSocial'}
        </button>
      </div>
    </form>
  )
}
