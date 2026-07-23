'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Establishment } from '../types'
import { createEstablishmentAction, updateEstablishmentAction } from '../actions'
import { AlertCircle, Save } from 'lucide-react'

interface EstablishmentFormProps {
  establishment?: Establishment
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

export function EstablishmentForm({ establishment }: EstablishmentFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [form, setForm] = useState({
    type: (establishment?.type || 'BRANCH') as 'HEADQUARTERS' | 'BRANCH',
    code: establishment?.code || '',
    name: establishment?.name || '',
    cnpj: establishment?.cnpj || '',
    stateRegistration: establishment?.state_registration || '',
    municipalRegistration: establishment?.municipal_registration || '',
    city: establishment?.city || '',
    state: establishment?.state || '',
    municipalityCode: establishment?.municipality_code || '',
    addressLine: establishment?.address_line || ''
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})

    startTransition(async () => {
      const res = establishment
        ? await updateEstablishmentAction({ id: establishment.id, ...form })
        : await createEstablishmentAction(form)

      if (res.ok) {
        router.push('/fiscal/cadastros/estabelecimentos')
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tipo *</label>
            <select className={inputClass} value={form.type} onChange={(e) => update('type', e.target.value as 'HEADQUARTERS' | 'BRANCH')}>
              <option value="HEADQUARTERS">Matriz</option>
              <option value="BRANCH">Filial</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Nome</label>
            <input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ex.: Filial Cuiabá" />
          </div>
          <div>
            <label className={labelClass}>Código (interno, opcional)</label>
            <input className={inputClass} value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="Ex.: FIL-01" />
          </div>
          <div>
            <label className={labelClass}>CNPJ *</label>
            <input className={inputClass} value={form.cnpj} onChange={(e) => update('cnpj', e.target.value)} required />
            {fieldErrors.cnpj && <p className="text-xs text-red-600 mt-1">{fieldErrors.cnpj[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Inscrição Estadual</label>
            <input className={inputClass} value={form.stateRegistration} onChange={(e) => update('stateRegistration', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Inscrição Municipal</label>
            <input className={inputClass} value={form.municipalRegistration} onChange={(e) => update('municipalRegistration', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Município</label>
            <input className={inputClass} value={form.city} onChange={(e) => update('city', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>UF</label>
            <input className={inputClass} value={form.state} onChange={(e) => update('state', e.target.value.toUpperCase())} maxLength={2} />
          </div>
          <div>
            <label className={labelClass}>Código IBGE do Município</label>
            <input className={inputClass} value={form.municipalityCode} onChange={(e) => update('municipalityCode', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Endereço</label>
            <input className={inputClass} value={form.addressLine} onChange={(e) => update('addressLine', e.target.value)} placeholder="Logradouro, número, bairro" />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
          Cadastro estrutural de matriz/filiais — útil para empresas com mais de uma inscrição estadual/municipal (ex.: transportadoras multi-UF).
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/fiscal/cadastros/estabelecimentos')}
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
          {isPending ? 'Salvando...' : establishment ? 'Salvar Alterações' : 'Criar Estabelecimento'}
        </button>
      </div>
    </form>
  )
}
