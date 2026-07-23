'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BankAccount } from '../types'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { createBankAccountAction, updateBankAccountAction } from '../actions'
import { AlertCircle, Save } from 'lucide-react'

interface BankAccountFormProps {
  bankAccount?: BankAccount
  eligibleChartAccounts: ChartAccount[]
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

export function BankAccountForm({ bankAccount, eligibleChartAccounts }: BankAccountFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [form, setForm] = useState({
    chartAccountId: bankAccount?.chart_account_id || '',
    bankName: bankAccount?.bank_name || '',
    bankCode: bankAccount?.bank_code || '',
    agency: bankAccount?.agency || '',
    accountNumber: bankAccount?.account_number || '',
    accountDigit: bankAccount?.account_digit || '',
    accountType: (bankAccount?.account_type || 'CHECKING') as 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT',
    holderName: bankAccount?.holder_name || '',
    holderDocument: bankAccount?.holder_document || '',
    openingBalance: bankAccount?.opening_balance != null ? Number(bankAccount.opening_balance) : undefined as number | undefined
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})

    startTransition(async () => {
      const res = bankAccount
        ? await updateBankAccountAction({ id: bankAccount.id, ...form })
        : await createBankAccountAction(form)

      if (res.ok) {
        router.push('/cadastros/contas-bancarias')
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
          <div className="sm:col-span-2">
            <label className={labelClass}>Conta Contábil Correspondente *</label>
            <select className={inputClass} value={form.chartAccountId} onChange={(e) => update('chartAccountId', e.target.value)} required>
              <option value="">— Selecione —</option>
              {eligibleChartAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>
              ))}
            </select>
            {fieldErrors.chartAccountId && <p className="text-xs text-red-600 mt-1">{fieldErrors.chartAccountId[0]}</p>}
          </div>
          <div>
            <label className={labelClass}>Banco</label>
            <input className={inputClass} value={form.bankName} onChange={(e) => update('bankName', e.target.value)} placeholder="Ex: Sicredi" />
          </div>
          <div>
            <label className={labelClass}>Código do Banco</label>
            <input className={inputClass} value={form.bankCode} onChange={(e) => update('bankCode', e.target.value)} placeholder="Ex: 748" />
          </div>
          <div>
            <label className={labelClass}>Agência</label>
            <input className={inputClass} value={form.agency} onChange={(e) => update('agency', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Conta</label>
              <input className={inputClass} value={form.accountNumber} onChange={(e) => update('accountNumber', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Dígito</label>
              <input className={inputClass} value={form.accountDigit} onChange={(e) => update('accountDigit', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Tipo de Conta *</label>
            <select className={inputClass} value={form.accountType} onChange={(e) => update('accountType', e.target.value as typeof form.accountType)}>
              <option value="CHECKING">Conta Corrente</option>
              <option value="SAVINGS">Poupança</option>
              <option value="CASH">Caixa (Numerário)</option>
              <option value="INVESTMENT">Investimento</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Saldo de Abertura</label>
            <input
              className={inputClass}
              type="number"
              step="0.01"
              value={form.openingBalance ?? ''}
              onChange={(e) => update('openingBalance', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Titular</label>
            <input className={inputClass} value={form.holderName} onChange={(e) => update('holderName', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>CPF/CNPJ do Titular</label>
            <input className={inputClass} value={form.holderDocument} onChange={(e) => update('holderDocument', e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
          Cadastro estrutural apenas — sem extrato, sem conciliação, sem contas a pagar/receber. Esses fluxos pertencem ao futuro módulo Financeiro.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/cadastros/contas-bancarias')}
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
          {isPending ? 'Salvando...' : bankAccount ? 'Salvar Alterações' : 'Criar Conta Bancária'}
        </button>
      </div>
    </form>
  )
}
