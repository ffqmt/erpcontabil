'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BankStatementLine } from '../types'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { Partner } from '@/modules/registrations/partners/types'
import { classifyBankStatementLineAction, generateJournalEntryFromBankLineAction, linkExistingJournalEntryLineAction } from '../actions'
import { applyReconciliationRuleToLineAction } from '../reconciliation-rules/actions'
import { ReconciliationRule, DIRECTION_LABELS } from '../reconciliation-rules/types'
import { formatCurrencyBRL, formatDateBR } from '../utils'
import { AlertCircle, CheckCircle, Save, Zap, Link2, Sparkles } from 'lucide-react'

interface CostCenterOption {
  id: string
  code: string
  name: string
}

interface CandidateJournalEntryLine {
  id: string
  amount: number | string
  debit_credit: string
  journal_entries: {
    id: string
    number: number | null
    entry_date: string
    description: string
  }
}

interface BankStatementClassificationFormProps {
  line: BankStatementLine
  chartAccounts: ChartAccount[]
  partners: Partner[]
  costCenters: CostCenterOption[]
  candidates: CandidateJournalEntryLine[]
  matchedRule?: ReconciliationRule | null
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

export function BankStatementClassificationForm({ line, chartAccounts, partners, costCenters, candidates, matchedRule }: BankStatementClassificationFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [counterpartyAccountId, setCounterpartyAccountId] = useState(line.counterparty_account_id || '')
  const [partnerId, setPartnerId] = useState(line.partner_id || '')
  const [costCenterId, setCostCenterId] = useState(line.cost_center_id || '')
  const [memo, setMemo] = useState(line.classification_memo || '')

  function handleApplyRule() {
    if (!matchedRule) return
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await applyReconciliationRuleToLineAction({ lineId: line.id })
      if (res.ok) {
        setSuccessMsg(res.message || 'Regra aplicada — rascunho gerado.')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  function handleUseRuleSuggestion() {
    if (!matchedRule) return
    setCounterpartyAccountId(matchedRule.counterparty_account_id)
    if (matchedRule.partner_id) setPartnerId(matchedRule.partner_id)
    if (matchedRule.cost_center_id) setCostCenterId(matchedRule.cost_center_id)
  }

  const amount = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
  const isInflow = amount > 0

  function runAction(actionFn: typeof classifyBankStatementLineAction | typeof generateJournalEntryFromBankLineAction, successRedirect: boolean) {
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await actionFn({ lineId: line.id, counterpartyAccountId, partnerId, costCenterId, memo })
      if (res.ok) {
        setSuccessMsg(res.message || 'Operação concluída.')
        router.refresh()
        if (successRedirect) {
          setTimeout(() => router.push('/bancos/conciliacao'), 800)
        }
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  function handleLink(journalEntryLineId: string) {
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await linkExistingJournalEntryLineAction({ lineId: line.id, journalEntryLineId })
      if (res.ok) {
        setSuccessMsg(res.message || 'Vinculado com sucesso.')
        router.refresh()
        setTimeout(() => router.push('/bancos/conciliacao'), 800)
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  const eligibleAccounts = chartAccounts.filter((a) => a.accepts_entries && !a.is_synthetic && a.is_active)
  const isReadOnly = line.status === 'RECONCILED'

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

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dados da Linha</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-[10px] text-gray-400 block">Data</span>
            <span className="font-semibold text-gray-800">{formatDateBR(line.entry_date)}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 block">Valor</span>
            <span className={`font-mono font-bold ${isInflow ? 'text-green-700' : 'text-red-700'}`}>{formatCurrencyBRL(amount)}</span>
          </div>
          <div className="col-span-2">
            <span className="text-[10px] text-gray-400 block">Descrição</span>
            <span className="font-semibold text-gray-800">{line.description}</span>
          </div>
          {line.document_number && (
            <div>
              <span className="text-[10px] text-gray-400 block">Documento</span>
              <span className="text-gray-700">{line.document_number}</span>
            </div>
          )}
        </div>
      </div>

      {matchedRule && !isReadOnly && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
            <Sparkles className="w-4 h-4" />
            Regra de conciliação casada: &quot;{matchedRule.name}&quot;
          </div>
          <p className="text-xs text-indigo-700">
            Sugere <strong>{matchedRule.counterparty_account ? `${matchedRule.counterparty_account.code} — ${matchedRule.counterparty_account.name}` : 'conta de contrapartida'}</strong>
            {matchedRule.partner?.name ? <> · parceiro <strong>{matchedRule.partner.name}</strong></> : ''}
            {' '}({DIRECTION_LABELS[matchedRule.direction]}).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleUseRuleSuggestion}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-300 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              Usar sugestão no formulário abaixo
            </button>
            <button
              type="button"
              onClick={handleApplyRule}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isPending ? 'Gerando...' : 'Aplicar Regra (gera rascunho para revisão)'}
            </button>
          </div>
        </div>
      )}

      {isReadOnly ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-sm text-green-800">
          Esta linha já está <strong>conciliada</strong>
          {line.journal_entry_line?.journal_entry?.number ? ` com o lançamento nº ${line.journal_entry_line.journal_entry.number}` : ''}.
          Para alterar a classificação, desfaça a conciliação na listagem antes.
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Classificação</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Conta Contábil de Contrapartida *</label>
                <select className={inputClass} value={counterpartyAccountId} onChange={(e) => setCounterpartyAccountId(e.target.value)}>
                  <option value="">— Selecione —</option>
                  {eligibleAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Parceiro (opcional)</label>
                <select className={inputClass} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                  <option value="">— Nenhum —</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Centro de Custo (opcional)</label>
                <select className={inputClass} value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
                  <option value="">— Nenhum —</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Histórico / Observação (opcional — senão usa a descrição da linha)</label>
                <input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => runAction(classifyBankStatementLineAction, false)}
                disabled={isPending || !counterpartyAccountId}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold text-sm rounded-lg disabled:opacity-50 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Salvar Classificação
              </button>
              <button
                type="button"
                onClick={() => runAction(generateJournalEntryFromBankLineAction, true)}
                disabled={isPending || !counterpartyAccountId}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                {isPending ? 'Processando...' : 'Gerar Lançamento e Conciliar'}
              </button>
            </div>
          </div>

          {candidates.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ou Vincular a Lançamento Já Existente</h3>
              <p className="text-[11px] text-gray-400">Encontramos lançamentos POSTED com valor e sentido compatíveis, próximos da data desta linha.</p>
              <div className="space-y-2">
                {candidates.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-3 border border-gray-150 rounded-lg text-xs">
                    <div>
                      <span className="font-mono font-bold text-gray-700">nº {c.journal_entries.number}</span>{' '}
                      <span className="text-gray-500">{formatDateBR(c.journal_entries.entry_date)} — {c.journal_entries.description}</span>
                    </div>
                    <button
                      onClick={() => handleLink(c.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Vincular
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
