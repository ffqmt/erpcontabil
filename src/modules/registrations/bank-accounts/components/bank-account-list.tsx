'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BankAccount } from '../types'
import { toggleBankAccountActiveAction } from '../actions'
import { Pencil, Power, Landmark } from 'lucide-react'

interface BankAccountListProps {
  bankAccounts: BankAccount[]
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CHECKING: 'Conta Corrente',
  SAVINGS: 'Poupança',
  CASH: 'Caixa',
  INVESTMENT: 'Investimento'
}

function BankAccountRow({ bankAccount }: { bankAccount: BankAccount }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const label = bankAccount.bank_name || 'esta conta bancária'
    const confirmMsg = bankAccount.active ? `Inativar ${label}?` : `Reativar ${label}?`
    if (!window.confirm(confirmMsg)) return

    startTransition(async () => {
      await toggleBankAccountActiveAction({ id: bankAccount.id, active: !bankAccount.active })
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 flex-shrink-0">
          <Landmark className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800 text-sm truncate">{bankAccount.bank_name || 'Banco não informado'}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${bankAccount.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {bankAccount.active ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-mono">
            Ag. {bankAccount.agency || '—'} · Conta {bankAccount.account_number || '—'}{bankAccount.account_digit ? `-${bankAccount.account_digit}` : ''}
          </p>
          <p className="text-xs text-gray-400">
            {ACCOUNT_TYPE_LABEL[bankAccount.account_type]}
            {bankAccount.chart_account ? ` · Conta contábil: ${bankAccount.chart_account.code} - ${bankAccount.chart_account.name}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/cadastros/contas-bancarias/${bankAccount.id}/editar`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Link>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
            bankAccount.active
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-green-200 text-green-700 hover:bg-green-50'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {bankAccount.active ? 'Inativar' : 'Reativar'}
        </button>
      </div>
    </div>
  )
}

export function BankAccountList({ bankAccounts }: BankAccountListProps) {
  if (bankAccounts.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 flex flex-col items-center gap-2">
        <Landmark className="w-8 h-8 text-gray-300" />
        <span className="text-sm font-semibold text-gray-600">Nenhuma conta bancária cadastrada</span>
        <p className="text-xs text-gray-400 max-w-xs">Clique em "Nova Conta Bancária" para cadastrar. É necessário ter uma conta correspondente no Plano de Contas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {bankAccounts.map((bankAccount) => (
        <BankAccountRow key={bankAccount.id} bankAccount={bankAccount} />
      ))}
    </div>
  )
}
