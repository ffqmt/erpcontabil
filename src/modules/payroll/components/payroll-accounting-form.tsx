'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, SendToBack } from 'lucide-react'
import { AccountSelect } from '@/modules/accounting/journal/components/account-select'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { accountPayrollEventAction } from '../actions'
import { PayrollEsocialEvent } from '../types'
import { formatCurrencyBRL } from '../utils'

interface PayrollAccountingFormProps {
  event: PayrollEsocialEvent
  accounts: ChartAccount[]
}

const labelClass = 'text-[10px] font-semibold text-gray-500 uppercase block mb-1'

function amount(value: number | string | null | undefined): number {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return Number.isFinite(num) ? Number(num) : 0
}

export function PayrollAccountingForm({ event, accounts }: PayrollAccountingFormProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const grossAmount = amount(event.gross_amount)
  const netAmount = amount(event.net_amount)
  const inssAmount = amount(event.inss_employee_amount)
  const irrfAmount = amount(event.irrf_amount)
  const fgtsAmount = amount(event.fgts_amount)
  const employerInssAmount = amount(event.employer_inss_amount)
  const otherDeductionsAmount = Math.max(0, grossAmount - netAmount - inssAmount - irrfAmount)
  const isProvision = grossAmount > 0

  const [form, setForm] = useState({
    salaryExpenseAccountId: '',
    salariesPayableAccountId: '',
    inssPayableAccountId: '',
    irrfPayableAccountId: '',
    otherDeductionsAccountId: '',
    fgtsExpenseAccountId: '',
    fgtsPayableAccountId: '',
    employerInssExpenseAccountId: '',
    employerInssPayableAccountId: '',
    paymentAccountId: ''
  })

  const previewLines = useMemo(() => {
    if (isProvision) {
      const lines = [
        { side: 'D', label: 'Despesa de remuneração', value: grossAmount },
        { side: 'C', label: 'Salários a pagar', value: netAmount }
      ]
      if (inssAmount > 0) lines.push({ side: 'C', label: 'INSS descontado', value: inssAmount })
      if (irrfAmount > 0) lines.push({ side: 'C', label: 'IRRF descontado', value: irrfAmount })
      if (otherDeductionsAmount > 0.009) lines.push({ side: 'C', label: 'Outros descontos', value: otherDeductionsAmount })
      if (fgtsAmount > 0) {
        lines.push({ side: 'D', label: 'Despesa de FGTS', value: fgtsAmount })
        lines.push({ side: 'C', label: 'FGTS a recolher', value: fgtsAmount })
      }
      if (employerInssAmount > 0) {
        lines.push({ side: 'D', label: 'Despesa de INSS patronal', value: employerInssAmount })
        lines.push({ side: 'C', label: 'INSS patronal a recolher', value: employerInssAmount })
      }
      return lines
    }

    return [
      { side: 'D', label: 'Baixa de salários a pagar', value: netAmount },
      { side: 'C', label: 'Conta de pagamento/banco', value: netAmount }
    ]
  }, [employerInssAmount, fgtsAmount, grossAmount, inssAmount, irrfAmount, isProvision, netAmount, otherDeductionsAmount])

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    startTransition(async () => {
      const res = await accountPayrollEventAction({ id: event.id, ...form })
      if (res.ok) {
        setSuccessMsg(res.message || 'Evento integrado.')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  if (event.accounting_status === 'ACCOUNTED') {
    return (
      <div className="border-t border-gray-100 pt-3 text-xs text-emerald-700 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        <span>Evento já integrado à contabilidade.</span>
      </div>
    )
  }

  return (
    <div className="border-t border-gray-100 pt-3">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          <SendToBack className="w-3.5 h-3.5" />
          Integrar na Contabilidade
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-800">Integração contábil</p>
              <p className="text-xs text-gray-500">
                {isProvision ? 'Provisão da folha com salários, descontos e encargos identificados.' : 'Pagamento/baixa da folha a pagar.'}
              </p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-800 cursor-pointer">
              Fechar
            </button>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {isProvision && (
              <div>
                <label className={labelClass}>Despesa de salários *</label>
                <AccountSelect accounts={accounts} value={form.salaryExpenseAccountId} onChange={(value) => update('salaryExpenseAccountId', value)} />
              </div>
            )}
            <div>
              <label className={labelClass}>Salários a pagar *</label>
              <AccountSelect accounts={accounts} value={form.salariesPayableAccountId} onChange={(value) => update('salariesPayableAccountId', value)} />
            </div>
            {!isProvision && (
              <div>
                <label className={labelClass}>Conta de pagamento/banco *</label>
                <AccountSelect accounts={accounts} value={form.paymentAccountId} onChange={(value) => update('paymentAccountId', value)} />
              </div>
            )}
            {inssAmount > 0 && (
              <div>
                <label className={labelClass}>INSS a recolher *</label>
                <AccountSelect accounts={accounts} value={form.inssPayableAccountId} onChange={(value) => update('inssPayableAccountId', value)} />
              </div>
            )}
            {irrfAmount > 0 && (
              <div>
                <label className={labelClass}>IRRF a recolher *</label>
                <AccountSelect accounts={accounts} value={form.irrfPayableAccountId} onChange={(value) => update('irrfPayableAccountId', value)} />
              </div>
            )}
            {otherDeductionsAmount > 0.009 && (
              <div>
                <label className={labelClass}>Outros descontos *</label>
                <AccountSelect accounts={accounts} value={form.otherDeductionsAccountId} onChange={(value) => update('otherDeductionsAccountId', value)} />
              </div>
            )}
            {fgtsAmount > 0 && (
              <>
                <div>
                  <label className={labelClass}>Despesa de FGTS *</label>
                  <AccountSelect accounts={accounts} value={form.fgtsExpenseAccountId} onChange={(value) => update('fgtsExpenseAccountId', value)} />
                </div>
                <div>
                  <label className={labelClass}>FGTS a recolher *</label>
                  <AccountSelect accounts={accounts} value={form.fgtsPayableAccountId} onChange={(value) => update('fgtsPayableAccountId', value)} />
                </div>
              </>
            )}
            {employerInssAmount > 0 && (
              <>
                <div>
                  <label className={labelClass}>Despesa de INSS patronal *</label>
                  <AccountSelect accounts={accounts} value={form.employerInssExpenseAccountId} onChange={(value) => update('employerInssExpenseAccountId', value)} />
                </div>
                <div>
                  <label className={labelClass}>INSS patronal a recolher *</label>
                  <AccountSelect accounts={accounts} value={form.employerInssPayableAccountId} onChange={(value) => update('employerInssPayableAccountId', value)} />
                </div>
              </>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Prévia das partidas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {previewLines.map((line) => (
                <div key={`${line.side}-${line.label}`} className="flex justify-between gap-3 border border-gray-100 rounded px-2 py-1.5">
                  <span className={line.side === 'D' ? 'text-blue-700 font-semibold' : 'text-amber-700 font-semibold'}>{line.side} — {line.label}</span>
                  <span className="font-mono text-gray-800">{formatCurrencyBRL(line.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              <SendToBack className="w-3.5 h-3.5" />
              {isPending ? 'Integrando...' : 'Gerar Lançamento'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
