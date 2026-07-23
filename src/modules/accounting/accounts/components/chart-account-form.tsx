'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChartAccount, AccountType, NormalBalance } from '../types'
import { createChartAccountAction, updateChartAccountAction } from '../actions'
import { AlertCircle, Save, X } from 'lucide-react'

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'ASSET', label: 'Ativo' },
  { value: 'LIABILITY', label: 'Passivo' },
  { value: 'EQUITY', label: 'Patrimônio Líquido' },
  { value: 'REVENUE', label: 'Receita' },
  { value: 'REVENUE_DEDUCTION', label: 'Dedução de Receita' },
  { value: 'COST', label: 'Custo' },
  { value: 'EXPENSE', label: 'Despesa' }
]

interface ChartAccountFormProps {
  account?: ChartAccount
  accounts: ChartAccount[]
  onClose: () => void
  onSuccess: () => void
}

export function ChartAccountForm({ account, accounts, onClose, onSuccess }: ChartAccountFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [code, setCode] = useState(account?.code || '')
  const [name, setName] = useState(account?.name || '')
  const [accountType, setAccountType] = useState<AccountType>(account?.account_type || 'ASSET')
  const [normalBalance, setNormalBalance] = useState<NormalBalance>(account?.normal_balance || 'DEBIT')
  const [parentId, setParentId] = useState(account?.parent_id || '')
  const [isSynthetic, setIsSynthetic] = useState(account?.is_synthetic ?? false)

  // Só contas sintéticas podem ser pai — evita já de cara oferecer uma opção que a action
  // vai recusar (parent_not_synthetic). Exclui a própria conta (não pode ser pai de si).
  const eligibleParents = accounts.filter((a) => a.is_synthetic && a.id !== account?.id)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})

    startTransition(async () => {
      const payload = { code, name, accountType, normalBalance, parentId, isSynthetic }
      const res = account
        ? await updateChartAccountAction({ id: account.id, ...payload })
        : await createChartAccountAction(payload)

      if (res.ok) {
        onSuccess()
        router.refresh()
      } else {
        setErrorMsg(res.error)
        setFieldErrors(res.fieldErrors || {})
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl shadow-md p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="text-sm font-bold text-gray-800">{account ? 'Editar Conta Contábil' : 'Nova Conta Contábil'}</h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Código *</label>
          <input className={`${inputClass} font-mono`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: 1.1.02" required />
          {fieldErrors.code && <p className="text-xs text-red-600 mt-1">{fieldErrors.code[0]}</p>}
        </div>
        <div>
          <label className={labelClass}>Nome *</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name[0]}</p>}
        </div>
        <div>
          <label className={labelClass}>Tipo *</label>
          <select className={inputClass} value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)}>
            {ACCOUNT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Natureza *</label>
          <select className={inputClass} value={normalBalance} onChange={(e) => setNormalBalance(e.target.value as NormalBalance)}>
            <option value="DEBIT">Devedora</option>
            <option value="CREDIT">Credora</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Conta Pai (opcional)</label>
          <select className={inputClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Conta de nível raiz —</option>
            {eligibleParents.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
          {fieldErrors.parentId && <p className="text-xs text-red-600 mt-1">{fieldErrors.parentId[0]}</p>}
          <p className="text-[11px] text-gray-400 mt-1">Só contas marcadas como sintéticas aparecem aqui — o nível é calculado automaticamente a partir do código.</p>
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input type="checkbox" id="isSynthetic" checked={isSynthetic} onChange={(e) => setIsSynthetic(e.target.checked)} className="w-4 h-4" />
          <label htmlFor="isSynthetic" className="text-sm text-gray-700">
            Conta sintética (agrupadora — <strong>não aceita lançamentos</strong>, só existe para somar suas subcontas)
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 cursor-pointer">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg disabled:opacity-50 cursor-pointer">
          <Save className="w-4 h-4" />
          {isPending ? 'Salvando...' : account ? 'Salvar Alterações' : 'Criar Conta'}
        </button>
      </div>
    </form>
  )
}
