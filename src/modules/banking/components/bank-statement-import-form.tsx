'use client'

import React, { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { importBankStatementCsvAction } from '../actions'
import { parseBankStatementCsv } from '../csv-parser'
import { AlertCircle, CheckCircle, Upload, Eye } from 'lucide-react'

interface BankStatementImportFormProps {
  bankAccounts: { id: string; bank_name: string | null; agency: string | null; account_number: string | null }[]
}

const EXAMPLE_CSV = `date,description,amount,document_number,balance
2025-01-08,PIX RECEBIDO CLIENTE DEMO,500.00,,100500.00
2025-01-10,TARIFA PACOTE DE SERVICOS,-45.00,,100455.00`

const EXAMPLE_CSV_BR = `Data;Cód. Conta Débito;Cód. Conta Crédito;Valor;Cód. Histórico;Complemento Histórico
08/01/2025;;1234;500,00;001;RECEBIMENTO PIX CLIENTE DEMO
10/01/2025;5678;;-1.234,56;002;TARIFA PACOTE DE SERVICOS`

export function BankStatementImportForm({ bankAccounts }: BankStatementImportFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [bankAccountId, setBankAccountId] = useState('')
  const [fileName, setFileName] = useState('')
  const [csvText, setCsvText] = useState('')

  // Pré-visualização client-side (Etapa 30A) — reusa o mesmo parser puro da Server Action
  // (sem tocar banco de dados), permitindo mostrar contagens de válidas/inválidas e as 5
  // primeiras linhas antes de confirmar o envio.
  const preview = useMemo(() => {
    if (!csvText.trim()) return null
    try {
      return parseBankStatementCsv(csvText)
    } catch {
      return null
    }
  }, [csvText])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result || ''))
    reader.readAsText(file, 'utf-8')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    startTransition(async () => {
      const res = await importBankStatementCsvAction({ bankAccountId, fileName, csvText })
      if (res.ok) {
        setSuccessMsg(res.message || 'Importação concluída.')
        setCsvText('')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
  const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <label className={labelClass}>Conta Bancária *</label>
          <select className={inputClass} value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required>
            <option value="">— Selecione —</option>
            {bankAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.bank_name || 'Banco'} — Ag. {acc.agency || '—'} Conta {acc.account_number || '—'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Arquivo CSV (opcional — ou cole o conteúdo abaixo)</label>
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="text-xs text-gray-600" />
          {fileName && <p className="text-[11px] text-gray-400 mt-1">Arquivo: {fileName}</p>}
        </div>

        <div>
          <label className={labelClass}>Conteúdo CSV *</label>
          <textarea
            className={`${inputClass} font-mono text-xs`}
            rows={10}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={EXAMPLE_CSV}
            required
          />
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[11px] text-gray-500 leading-relaxed space-y-3">
          <div>
            <strong className="block text-gray-700 mb-1">Formato padrão (cabeçalho obrigatório na 1ª linha):</strong>
            <code className="block whitespace-pre font-mono">{EXAMPLE_CSV}</code>
          </div>
          <div>
            <strong className="block text-gray-700 mb-1">Formato brasileiro/Itaú (também aceito automaticamente):</strong>
            <code className="block whitespace-pre font-mono">{EXAMPLE_CSV_BR}</code>
          </div>
          <p>
            Colunas obrigatórias (em qualquer um dos 2 formatos): data, descrição (ou &quot;Complemento Histórico&quot;), valor (positivo = entrada, negativo = saída; aceita vírgula ou ponto decimal, milhar com ponto).
            Opcionais: número de documento (ou &quot;Cód. Histórico&quot;), saldo. Colunas de código de conta do banco (&quot;Cód. Conta Débito/Crédito&quot;) são ignoradas. Delimitador (vírgula ou ponto e vírgula) e datas (YYYY-MM-DD ou DD/MM/YYYY) são detectados automaticamente.
          </p>
        </div>

        {preview && (
          <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
              <Eye className="w-3.5 h-3.5" />
              Pré-visualização
            </div>
            <div className="flex gap-4 text-xs">
              <span className="text-green-700 font-semibold">{preview.validRows.length} válida(s)</span>
              <span className="text-red-700 font-semibold">{preview.invalidRows.length} inválida(s)</span>
              <span className="text-gray-500">{preview.totalLines} linha(s) de dados no total</span>
            </div>
            {preview.validRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="text-gray-400 text-left">
                      <th className="pr-3 py-1">Data</th>
                      <th className="pr-3 py-1">Descrição</th>
                      <th className="pr-3 py-1 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.validRows.slice(0, 5).map((r) => (
                      <tr key={r.lineNumber} className="border-t border-gray-100">
                        <td className="pr-3 py-1 font-mono">{r.entryDate}</td>
                        <td className="pr-3 py-1">{r.description}</td>
                        <td className={`pr-3 py-1 text-right font-mono ${r.amount > 0 ? 'text-green-700' : 'text-red-700'}`}>{r.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.validRows.length > 5 && <p className="text-gray-400 mt-1">+ {preview.validRows.length - 5} linha(s) adicional(is)</p>}
              </div>
            )}
            {preview.invalidRows.length > 0 && (
              <div className="space-y-1">
                {preview.invalidRows.slice(0, 5).map((r) => (
                  <p key={r.lineNumber} className="text-red-600">Linha {r.lineNumber}: {r.error}</p>
                ))}
                {preview.invalidRows.length > 5 && <p className="text-gray-400">+ {preview.invalidRows.length - 5} erro(s) adicional(is)</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/bancos')}
          className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          {isPending ? 'Importando...' : 'Importar Extrato'}
        </button>
      </div>
    </form>
  )
}
