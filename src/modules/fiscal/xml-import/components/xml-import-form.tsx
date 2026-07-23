'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { previewFiscalXmlAction, confirmFiscalXmlImportAction, rejectFiscalXmlImportAction } from '../actions'
import { FiscalXmlPreview, ParsedNfeItem } from '../types'
import { AlertCircle, CheckCircle, Upload, FileWarning, Sparkles, X } from 'lucide-react'

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

function formatCurrencyBRL(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

export function XmlImportForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [xmlText, setXmlText] = useState('')
  const [fileName, setFileName] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<FiscalXmlPreview | null>(null)

  // Campos editáveis do cabeçalho — pré-preenchidos a partir do parsing, revisáveis antes de confirmar.
  const [header, setHeader] = useState({
    documentNumber: '',
    series: '',
    issueDate: '',
    operationDate: '',
    emitCnpj: '',
    emitName: '',
    destCnpj: '',
    destCpf: '',
    destName: '',
    documentAmount: 0,
    merchandiseAmount: 0,
    freightAmount: 0,
    icmsBase: 0,
    icmsAmount: 0,
    pisAmount: 0,
    cofinsAmount: 0,
    issBase: 0,
    issAmount: 0,
    notes: ''
  })
  const [items, setItems] = useState<ParsedNfeItem[]>([])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setXmlText(String(reader.result || ''))
    reader.readAsText(file, 'utf-8')
  }

  function handlePreview() {
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await previewFiscalXmlAction({ xmlText, fileName })
      if (res.ok) {
        setPreview(res.data)
        const p = res.data.parsed
        setHeader({
          documentNumber: p.documentNumber || '',
          series: p.series || '',
          issueDate: p.issueDate || '',
          operationDate: p.operationDate || p.issueDate || '',
          emitCnpj: p.emitCnpj || '',
          emitName: p.emitName || '',
          destCnpj: p.destCnpj || '',
          destCpf: p.destCpf || '',
          destName: p.destName || '',
          documentAmount: p.totalAmount || 0,
          merchandiseAmount: p.merchandiseAmount || 0,
          freightAmount: p.freightAmount || 0,
          icmsBase: p.icmsBase || 0,
          icmsAmount: p.icmsAmount || 0,
          pisAmount: p.pisAmount || 0,
          cofinsAmount: p.cofinsAmount || 0,
          issBase: p.issBase || 0,
          issAmount: p.issAmount || 0,
          notes: p.naturezaOperacao || ''
        })
        setItems(p.items)
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  function handleConfirm() {
    if (!preview) return
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await confirmFiscalXmlImportAction({
        xmlImportId: preview.xmlImportId,
        accessKey: preview.parsed.accessKey || '',
        ...header,
        items: items.map((it) => ({
          lineNumber: it.lineNumber,
          description: it.description,
          itemType: 'PRODUCT' as const,
          quantity: it.quantity,
          unit: it.unit || '',
          unitPrice: it.unitPrice ?? undefined,
          totalAmount: it.totalAmount,
          ncm: it.ncm || '',
          cfop: it.cfop || '',
          icmsAmount: it.icmsAmount ?? undefined,
          ipiAmount: it.ipiAmount ?? undefined,
          pisAmount: it.pisAmount ?? undefined,
          cofinsAmount: it.cofinsAmount ?? undefined,
          issAmount: it.issAmount ?? undefined
        }))
      })
      if (res.ok) {
        setSuccessMsg(res.message || 'Documento fiscal importado com sucesso!')
        setTimeout(() => router.push(`/fiscal/documentos/${res.data.fiscalDocumentId}`), 1200)
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  function handleReject() {
    if (!preview) return
    if (!window.confirm('Descartar esta importação? Nenhum documento fiscal será criado.')) return
    startTransition(async () => {
      await rejectFiscalXmlImportAction({ xmlImportId: preview.xmlImportId })
      setPreview(null)
      setXmlText('')
      setFileName('')
      setSuccessMsg('Importação descartada.')
    })
  }

  const canConfirm = preview && preview.blockingErrors.length === 0 && !isPending

  return (
    <div className="space-y-6">
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

      {!preview ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Importar XML Fiscal (NF-e, CT-e ou NFS-e)</h3>
          <div>
            <label className={labelClass}>Arquivo XML (opcional — ou cole o conteúdo abaixo)</label>
            <input type="file" accept=".xml,text/xml" onChange={handleFileChange} className="text-xs text-gray-600" />
            {fileName && <p className="text-[11px] text-gray-400 mt-1">Arquivo: {fileName}</p>}
          </div>
          <div>
            <label className={labelClass}>Conteúdo XML *</label>
            <textarea
              className={`${inputClass} font-mono text-xs`}
              rows={8}
              value={xmlText}
              onChange={(e) => setXmlText(e.target.value)}
              placeholder="Cole aqui o XML fiscal (NF-e, CT-e ou NFS-e)..."
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isPending || !xmlText.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              {isPending ? 'Processando...' : 'Processar XML'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-white px-2 py-1 rounded-full">
              {preview.documentType === 'NFE' ? 'NF-e' : preview.documentType === 'CTE' ? 'CT-e' : 'NFS-e'}
            </span>
            {preview.direction && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                {preview.direction === 'IN' ? 'Entrada' : 'Saída'}
              </span>
            )}
          </div>
          {preview.documentType === 'NFSE' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
              NFS-e não tem layout nacional único — os campos foram localizados por busca tolerante de nome de tag e podem precisar de ajuste manual. Revise tudo com atenção antes de confirmar.
            </div>
          )}
          {preview.blockingErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                <FileWarning className="w-4 h-4" />
                Pendências que impedem a confirmação
              </div>
              {preview.blockingErrors.map((err, i) => (
                <p key={i} className="text-xs text-red-700">• {err}</p>
              ))}
            </div>
          )}
          {preview.parsed.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
              <div className="text-xs font-bold text-amber-800">Avisos (revise antes de confirmar)</div>
              {preview.parsed.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">• {w}</p>
              ))}
            </div>
          )}

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
              <Sparkles className="w-4 h-4" />
              {preview.direction === 'OUT' ? 'Cliente' : 'Fornecedor'}
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                {preview.direction === 'OUT' ? 'Saída' : 'Entrada'}
              </span>
            </div>
            <p className="text-xs text-indigo-700">
              {preview.partner.status === 'FOUND'
                ? <>Parceiro já cadastrado será reutilizado: <strong>{preview.partner.name}</strong>{preview.partner.hasLinkedAccount ? ` (já tem conta contábil de ${preview.direction === 'OUT' ? 'cliente' : 'fornecedor'})` : ` (uma conta contábil de ${preview.direction === 'OUT' ? 'cliente' : 'fornecedor'} será criada automaticamente)`}.</>
                : <>Novo {preview.direction === 'OUT' ? 'cliente' : 'fornecedor'} será criado automaticamente: <strong>{preview.partner.name}</strong>, com conta contábil vinculada.</>}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cabeçalho do Documento (revise antes de confirmar)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Número</label>
                <input className={inputClass} value={header.documentNumber} onChange={(e) => setHeader((h) => ({ ...h, documentNumber: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Série</label>
                <input className={inputClass} value={header.series} onChange={(e) => setHeader((h) => ({ ...h, series: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Chave de Acesso</label>
                <input className={`${inputClass} font-mono text-[11px]`} value={preview.parsed.accessKey || ''} readOnly disabled />
              </div>
              <div>
                <label className={labelClass}>Data de Emissão *</label>
                <input type="date" className={inputClass} value={header.issueDate} onChange={(e) => setHeader((h) => ({ ...h, issueDate: e.target.value }))} required />
              </div>
              <div>
                <label className={labelClass}>Data de Operação (entrada/saída) *</label>
                <input type="date" className={inputClass} value={header.operationDate} onChange={(e) => setHeader((h) => ({ ...h, operationDate: e.target.value }))} required />
              </div>
              <div />
              <div>
                <label className={labelClass}>CNPJ/CPF do Emitente *</label>
                <input className={inputClass} value={header.emitCnpj} onChange={(e) => setHeader((h) => ({ ...h, emitCnpj: e.target.value }))} required />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Nome/Razão Social do Emitente *</label>
                <input className={inputClass} value={header.emitName} onChange={(e) => setHeader((h) => ({ ...h, emitName: e.target.value }))} required />
              </div>
              <div>
                <label className={labelClass}>CNPJ/CPF do Destinatário{preview.direction === 'OUT' ? ' *' : ''}</label>
                <input
                  className={inputClass}
                  value={header.destCnpj || header.destCpf}
                  onChange={(e) => setHeader((h) => ({ ...h, destCnpj: e.target.value, destCpf: '' }))}
                  required={preview.direction === 'OUT'}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Nome/Razão Social do Destinatário{preview.direction === 'OUT' ? ' *' : ''}</label>
                <input
                  className={inputClass}
                  value={header.destName}
                  onChange={(e) => setHeader((h) => ({ ...h, destName: e.target.value }))}
                  required={preview.direction === 'OUT'}
                />
              </div>
              <div>
                <label className={labelClass}>Valor Total *</label>
                <input type="number" step="0.01" className={`${inputClass} font-mono`} value={header.documentAmount} onChange={(e) => setHeader((h) => ({ ...h, documentAmount: parseFloat(e.target.value) || 0 }))} required />
              </div>
              <div>
                <label className={labelClass}>Valor Mercadorias</label>
                <input type="number" step="0.01" className={`${inputClass} font-mono`} value={header.merchandiseAmount} onChange={(e) => setHeader((h) => ({ ...h, merchandiseAmount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelClass}>Frete</label>
                <input type="number" step="0.01" className={`${inputClass} font-mono`} value={header.freightAmount} onChange={(e) => setHeader((h) => ({ ...h, freightAmount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelClass}>Base ICMS</label>
                <input type="number" step="0.01" className={`${inputClass} font-mono`} value={header.icmsBase} onChange={(e) => setHeader((h) => ({ ...h, icmsBase: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelClass}>Valor ICMS</label>
                <input type="number" step="0.01" className={`${inputClass} font-mono`} value={header.icmsAmount} onChange={(e) => setHeader((h) => ({ ...h, icmsAmount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelClass}>Valor PIS</label>
                <input type="number" step="0.01" className={`${inputClass} font-mono`} value={header.pisAmount} onChange={(e) => setHeader((h) => ({ ...h, pisAmount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelClass}>Valor COFINS</label>
                <input type="number" step="0.01" className={`${inputClass} font-mono`} value={header.cofinsAmount} onChange={(e) => setHeader((h) => ({ ...h, cofinsAmount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelClass}>Base ISS</label>
                <input type="number" step="0.01" className={`${inputClass} font-mono`} value={header.issBase} onChange={(e) => setHeader((h) => ({ ...h, issBase: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelClass}>Valor ISS</label>
                <input type="number" step="0.01" className={`${inputClass} font-mono`} value={header.issAmount} onChange={(e) => setHeader((h) => ({ ...h, issAmount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="sm:col-span-3">
                <label className={labelClass}>Natureza da Operação / Observações</label>
                <input className={inputClass} value={header.notes} onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Itens ({items.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-100">
                    <th className="py-1.5 pr-2">Descrição</th>
                    <th className="py-1.5 pr-2">NCM</th>
                    <th className="py-1.5 pr-2">CFOP</th>
                    <th className="py-1.5 pr-2 text-right">Qtd</th>
                    <th className="py-1.5 pr-2 text-right">Valor Total</th>
                    <th className="py-1.5 pr-2 text-right">ICMS</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-50">
                      <td className="py-1.5 pr-2">{it.description}</td>
                      <td className="py-1.5 pr-2 font-mono">{it.ncm || '—'}</td>
                      <td className="py-1.5 pr-2 font-mono">{it.cfop || '—'}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{it.quantity}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{formatCurrencyBRL(it.totalAmount)}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{formatCurrencyBRL(it.icmsAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 hover:border-red-400 hover:text-red-700 text-gray-600 font-semibold text-sm rounded-lg disabled:opacity-50 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
              Descartar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              title={!canConfirm && preview.blockingErrors.length > 0 ? 'Resolva as pendências acima antes de confirmar' : undefined}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              {isPending ? 'Confirmando...' : 'Confirmar e Importar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
