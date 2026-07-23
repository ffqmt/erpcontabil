'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Company } from '../types'
import { createCompanyAction, updateCompanyAction } from '../actions'
import { AlertCircle, Save } from 'lucide-react'
import { StateSelect } from '@/modules/registrations/locations/components/state-select'

interface CompanyFormProps {
  company?: Company
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

export function CompanyForm({ company }: CompanyFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [form, setForm] = useState({
    legalName: company?.legal_name || '',
    tradeName: company?.trade_name || '',
    cnpj: company?.cnpj || '',
    stateRegistration: company?.state_registration || '',
    municipalRegistration: company?.municipal_registration || '',
    nire: company?.nire || '',
    incorporationDate: company?.incorporation_date || '',
    taxRegime: (company?.tax_regime || 'SIMPLES_NACIONAL') as 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL',
    companyProfile: (company?.company_profile || 'SERVICES') as 'TRANSPORTATION' | 'TRADE' | 'SERVICES' | 'INDUSTRY' | 'OTHER',
    city: company?.city || '',
    state: company?.state || '',
    responsibleName: company?.responsible_name || '',
    responsibleCpf: company?.responsible_cpf || '',
    responsibleRole: company?.responsible_role || '',
    responsibleCrc: company?.responsible_crc || '',
    mainCnae: company?.main_cnae || '',
    secondaryCnaesText: (company?.secondary_cnaes || []).join(', '),
    createDefaultChartAccounts: true,
    createInitialPeriod: true
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})

    startTransition(async () => {
      const { secondaryCnaesText, ...rest } = form
      const payload = {
        ...rest,
        secondaryCnaes: secondaryCnaesText.split(',').map((c) => c.trim()).filter(Boolean)
      }
      const res = company
        ? await updateCompanyAction({ id: company.id, ...payload })
        : await createCompanyAction(payload)

      if (res.ok) {
        router.push('/cadastros/empresas')
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
            <label className={labelClass}>Razão Social *</label>
            <input className={inputClass} value={form.legalName} onChange={(e) => update('legalName', e.target.value)} required />
            {fieldErrors.legalName && <p className="text-xs text-red-600 mt-1">{fieldErrors.legalName[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Nome Fantasia</label>
            <input className={inputClass} value={form.tradeName} onChange={(e) => update('tradeName', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>CNPJ *</label>
            <input className={inputClass} value={form.cnpj} onChange={(e) => update('cnpj', e.target.value)} placeholder="Somente números" required />
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
            <label className={labelClass}>NIRE</label>
            <input className={inputClass} value={form.nire} onChange={(e) => update('nire', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Data de Constituição</label>
            <input type="date" className={inputClass} value={form.incorporationDate} onChange={(e) => update('incorporationDate', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Regime e Perfil</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Regime Tributário *</label>
            <select className={inputClass} value={form.taxRegime} onChange={(e) => update('taxRegime', e.target.value as typeof form.taxRegime)}>
              <option value="SIMPLES_NACIONAL">Simples Nacional</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
              <option value="LUCRO_REAL">Lucro Real</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Perfil da Empresa *</label>
            <select className={inputClass} value={form.companyProfile} onChange={(e) => update('companyProfile', e.target.value as typeof form.companyProfile)}>
              <option value="TRANSPORTATION">Transporte</option>
              <option value="TRADE">Comércio</option>
              <option value="SERVICES">Serviços</option>
              <option value="INDUSTRY">Indústria</option>
              <option value="OTHER">Outro</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>CNAE Principal</label>
            <input className={inputClass} value={form.mainCnae} onChange={(e) => update('mainCnae', e.target.value)} placeholder="Ex: 4930-2/02" />
          </div>
          <div>
            <label className={labelClass}>CNAEs Secundários</label>
            <input className={inputClass} value={form.secondaryCnaesText} onChange={(e) => update('secondaryCnaesText', e.target.value)} placeholder="Separados por vírgula" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Localização</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Município</label>
            <input className={inputClass} value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Ex: São Paulo" />
          </div>
          <div>
            <label className={labelClass}>UF</label>
            <StateSelect value={form.state} onChange={(uf) => update('state', uf)} />
            {fieldErrors.state && <p className="text-xs text-red-600 mt-1">{fieldErrors.state[0]}</p>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Responsável Legal e Assinatura</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome do Responsável</label>
            <input className={inputClass} value={form.responsibleName} onChange={(e) => update('responsibleName', e.target.value)} placeholder="Ex: João da Silva" />
            {fieldErrors.responsibleName && <p className="text-xs text-red-600 mt-1">{fieldErrors.responsibleName[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>CPF do Responsável</label>
            <input className={inputClass} value={form.responsibleCpf} onChange={(e) => update('responsibleCpf', e.target.value)} placeholder="000.000.000-00" />
            {fieldErrors.responsibleCpf && <p className="text-xs text-red-600 mt-1">{fieldErrors.responsibleCpf[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Cargo/Função</label>
            <input className={inputClass} value={form.responsibleRole} onChange={(e) => update('responsibleRole', e.target.value)} placeholder="Ex: Administrador" />
            {fieldErrors.responsibleRole && <p className="text-xs text-red-600 mt-1">{fieldErrors.responsibleRole[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Registro CRC (Opcional - Contador)</label>
            <input className={inputClass} value={form.responsibleCrc} onChange={(e) => update('responsibleCrc', e.target.value)} placeholder="Ex: CRC-XX 000000/O" />
            {fieldErrors.responsibleCrc && <p className="text-xs text-red-600 mt-1">{fieldErrors.responsibleCrc[0]}</p>}
          </div>
        </div>
      </div>
 
      {!company && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Inicialização Operacional</h3>
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.createDefaultChartAccounts}
                onChange={(e) => update('createDefaultChartAccounts', e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 mt-0.5"
              />
              <div>
                <span className="text-sm font-semibold text-gray-800">Inicializar Plano de Contas Padrão</span>
                <p className="text-xs text-gray-500">Copia a estrutura completa de 56 contas de referência para habilitar relatórios contábeis (balancete, DRE, etc.).</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.createInitialPeriod}
                onChange={(e) => update('createInitialPeriod', e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 mt-0.5"
              />
              <div>
                <span className="text-sm font-semibold text-gray-800">Inicializar Período Contábil Inicial</span>
                <p className="text-xs text-gray-500">Abre o período contábil do mês corrente no status OPEN para possibilitar lançamentos e conciliação.</p>
              </div>
            </label>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/cadastros/empresas')}
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
          {isPending ? 'Salvando...' : company ? 'Salvar Alterações' : 'Criar Empresa'}
        </button>
      </div>
    </form>
  )
}
