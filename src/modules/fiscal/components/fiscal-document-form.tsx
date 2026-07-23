'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FiscalDocument } from '../types'
import { Partner } from '@/modules/registrations/partners/types'
import { FiscalOperationNature } from '@/modules/registrations/fiscal-natures/types'
import { createFiscalDocumentAction, updateFiscalDocumentAction } from '../actions'
import { AlertCircle, Save } from 'lucide-react'

interface FiscalDocumentFormProps {
  doc?: FiscalDocument
  partners: Partner[]
  natures: FiscalOperationNature[]
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

export function FiscalDocumentForm({ doc, partners, natures }: FiscalDocumentFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    partnerId: doc?.partner_id || '',
    fiscalOperationNatureId: doc?.fiscal_operation_nature_id || '',
    direction: (doc?.direction || 'IN') as 'IN' | 'OUT',
    documentType: (doc?.document_type || 'NFE') as string,
    operationType: (doc?.operation_type || 'PURCHASE') as string,
    documentNumber: doc?.number || '',
    series: doc?.series || '',
    issueDate: doc?.issue_date || '',
    operationDate: doc?.operation_date || '',
    documentAmount: doc ? Number(doc.document_amount) : 0,
    merchandiseAmount: doc?.merchandise_amount ? Number(doc.merchandise_amount) : undefined,
    servicesAmount: doc?.services_amount ? Number(doc.services_amount) : undefined,
    icmsAmount: doc?.icms_amount ? Number(doc.icms_amount) : undefined,
    issAmount: doc?.iss_amount ? Number(doc.iss_amount) : undefined,
    notes: doc?.notes || ''
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const res = doc ? await updateFiscalDocumentAction({ id: doc.id, ...form }) : await createFiscalDocumentAction(form)
      if (res.ok) {
        router.push(doc ? `/fiscal/documentos/${doc.id}` : `/fiscal/documentos/${(res.data as any).id}`)
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Identificação</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Direção *</label>
            <select className={inputClass} value={form.direction} onChange={(e) => update('direction', e.target.value as 'IN' | 'OUT')}>
              <option value="IN">Entrada</option>
              <option value="OUT">Saída</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Tipo de Documento *</label>
            <select className={inputClass} value={form.documentType} onChange={(e) => update('documentType', e.target.value)}>
              <option value="NFE">NF-e</option>
              <option value="NFCE">NFC-e</option>
              <option value="NFSE">NFS-e</option>
              <option value="CTE">CT-e</option>
              <option value="CTE_OS">CT-e OS</option>
              <option value="MDFE">MDF-e</option>
              <option value="MANUAL">Documento Manual</option>
              <option value="OTHER">Outro</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Tipo de Operação</label>
            <select className={inputClass} value={form.operationType} onChange={(e) => update('operationType', e.target.value)}>
              <option value="PURCHASE">Compra</option>
              <option value="SALE">Venda</option>
              <option value="SERVICE_TAKEN">Serviço Tomado</option>
              <option value="SERVICE_PROVIDED">Serviço Prestado</option>
              <option value="FREIGHT">Frete</option>
              <option value="RETURN">Devolução</option>
              <option value="TRANSFER">Transferência</option>
              <option value="OTHER">Outro</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Parceiro *</label>
            <select className={inputClass} value={form.partnerId} onChange={(e) => update('partnerId', e.target.value)} required>
              <option value="">— Selecione —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Natureza Fiscal</label>
            <select className={inputClass} value={form.fiscalOperationNatureId} onChange={(e) => update('fiscalOperationNatureId', e.target.value)}>
              <option value="">— Nenhuma —</option>
              {natures.map((n) => (
                <option key={n.id} value={n.id}>{n.code} — {n.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Número</label>
            <input className={inputClass} value={form.documentNumber} onChange={(e) => update('documentNumber', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Série</label>
            <input className={inputClass} value={form.series} onChange={(e) => update('series', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Data de Emissão *</label>
            <input type="date" className={inputClass} value={form.issueDate} onChange={(e) => update('issueDate', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Data de Operação (entrada/saída) *</label>
            <input type="date" className={inputClass} value={form.operationDate} onChange={(e) => update('operationDate', e.target.value)} required />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Valores</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Valor Total do Documento *</label>
            <input type="number" step="0.01" className={inputClass} value={form.documentAmount} onChange={(e) => update('documentAmount', Number(e.target.value))} required />
          </div>
          <div>
            <label className={labelClass}>Valor de Mercadorias</label>
            <input type="number" step="0.01" className={inputClass} value={form.merchandiseAmount ?? ''} onChange={(e) => update('merchandiseAmount', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>Valor de Serviços</label>
            <input type="number" step="0.01" className={inputClass} value={form.servicesAmount ?? ''} onChange={(e) => update('servicesAmount', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>ICMS Destacado</label>
            <input type="number" step="0.01" className={inputClass} value={form.icmsAmount ?? ''} onChange={(e) => update('icmsAmount', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>ISS Destacado</label>
            <input type="number" step="0.01" className={inputClass} value={form.issAmount ?? ''} onChange={(e) => update('issAmount', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
          Campos de tributos por item (ICMS/IPI/PIS/COFINS/ISS detalhados) ficam disponíveis na tela de itens, depois de criar o documento.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <label className={labelClass}>Observações</label>
        <textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push('/fiscal/documentos')} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer">
          <Save className="w-4 h-4" />
          {isPending ? 'Salvando...' : doc ? 'Salvar Alterações' : 'Criar Documento'}
        </button>
      </div>
    </form>
  )
}
