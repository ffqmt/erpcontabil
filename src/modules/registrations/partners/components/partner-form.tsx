'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Partner } from '../types'
import { createPartnerAction, updatePartnerAction } from '../actions'
import { AlertCircle, CheckCircle, Save } from 'lucide-react'
import { StateSelect } from '@/modules/registrations/locations/components/state-select'

interface PartnerFormProps {
  partner?: Partner
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

function warnPartnerRedirect(motivo: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[redirect-debug] origem partner-form -> /cadastros/parceiros', {
      rota: window.location.pathname,
      motivo
    })
  }
}

export function PartnerForm({ partner }: PartnerFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [form, setForm] = useState({
    name: partner?.name || '',
    legalName: partner?.legal_name || '',
    tradeName: partner?.trade_name || '',
    document: partner?.document || '',
    documentType: (partner?.document_type || 'CNPJ') as 'CPF' | 'CNPJ',
    email: partner?.email || '',
    phone: partner?.phone || '',
    stateRegistration: partner?.state_registration || '',
    municipalRegistration: partner?.municipal_registration || '',
    address: partner?.address || '',
    city: partner?.city || '',
    state: partner?.state || '',
    zipCode: partner?.zip_code || '',
    notes: partner?.notes || '',
    isCustomer: partner?.is_customer || false,
    isSupplier: partner?.is_supplier || false,
    isCarrier: partner?.is_carrier || false,
    isEmployee: partner?.is_employee || false,
    createCustomerAccount: false,
    createSupplierAccount: false
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})

    startTransition(async () => {
      const res = partner
        ? await updatePartnerAction({ id: partner.id, ...form })
        : await createPartnerAction(form)

      if (res.ok) {
        warnPartnerRedirect(partner ? 'update-success' : 'create-success')
        router.push('/cadastros/parceiros')
        router.refresh()
      } else {
        setErrorMsg(res.error)
        setFieldErrors(res.fieldErrors || {})
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome / Razão Social *</label>
            <input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} required />
            {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Nome Fantasia / Apelido</label>
            <input className={inputClass} value={form.tradeName} onChange={(e) => update('tradeName', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Razão Social (se diferente do nome)</label>
            <input className={inputClass} value={form.legalName} onChange={(e) => update('legalName', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Tipo de Documento</label>
            <select className={inputClass} value={form.documentType} onChange={(e) => update('documentType', e.target.value as 'CPF' | 'CNPJ')}>
              <option value="CNPJ">CNPJ (Pessoa Jurídica)</option>
              <option value="CPF">CPF (Pessoa Física)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>CPF/CNPJ</label>
            <input className={inputClass} value={form.document} onChange={(e) => update('document', e.target.value)} placeholder="Somente números" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Papéis *</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            ['isCustomer', 'Cliente'],
            ['isSupplier', 'Fornecedor'],
            ['isCarrier', 'Transportadora'],
            ['isEmployee', 'Colaborador']
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => update(key, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              {label}
            </label>
          ))}
        </div>
        {fieldErrors.isCustomer && <p className="text-xs text-red-600">{fieldErrors.isCustomer[0]}</p>}

        {(form.isCustomer || form.isSupplier) && (
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <span className="text-[11px] font-semibold text-gray-500 block">Conta Contábil Automática (opcional)</span>
            {form.isCustomer && (
              partner?.customer_account_id ? (
                <p className="text-xs text-gray-500">Já existe uma conta de Cliente vinculada a este parceiro.</p>
              ) : (
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.createCustomerAccount}
                    onChange={(e) => update('createCustomerAccount', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Criar automaticamente uma conta contábil analítica de Cliente (filha de 1.1.2 CLIENTES)
                </label>
              )
            )}
            {form.isSupplier && (
              partner?.supplier_account_id ? (
                <p className="text-xs text-gray-500">Já existe uma conta de Fornecedor vinculada a este parceiro.</p>
              ) : (
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.createSupplierAccount}
                    onChange={(e) => update('createSupplierAccount', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Criar automaticamente uma conta contábil analítica de Fornecedor (filha de 2.1.1 FORNECEDORES)
                </label>
              )
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contato</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>E-mail</label>
            <input className={inputClass} type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Telefone</label>
            <input className={inputClass} value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Endereço e Inscrições</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Endereço</label>
            <input className={inputClass} value={form.address} onChange={(e) => update('address', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Município</label>
            <input className={inputClass} value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Ex: São Paulo" />
          </div>
          <div>
            <label className={labelClass}>UF</label>
            <StateSelect
              value={form.state}
              onChange={(uf) => update('state', uf)}
            />
            {fieldErrors.state && <p className="text-xs text-red-600 mt-1">{fieldErrors.state[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>CEP</label>
            <input className={inputClass} value={form.zipCode} onChange={(e) => update('zipCode', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Inscrição Estadual</label>
            <input className={inputClass} value={form.stateRegistration} onChange={(e) => update('stateRegistration', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Inscrição Municipal</label>
            <input className={inputClass} value={form.municipalRegistration} onChange={(e) => update('municipalRegistration', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Observações</h3>
        <textarea
          className={inputClass}
          rows={3}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            warnPartnerRedirect('cancel-click')
            router.push('/cadastros/parceiros')
          }}
          className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Salvando...' : partner ? 'Salvar Alterações' : 'Criar Parceiro'}
        </button>
      </div>
    </form>
  )
}
