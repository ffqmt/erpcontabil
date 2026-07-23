'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiscalDocument } from '../types'
import { ChartAccount } from '@/modules/accounting/accounts/types'
import { DEBIT_CREDIT_LABELS, FiscalAccountingSuggestion, FiscalAccountingApplication, VALUE_BASE_LABELS } from '../accounting-rules/types'
import { accountFiscalDocumentAction, reverseFiscalDocumentAccountingAction, regenerateFiscalDocumentAccountingAction } from '../actions'
import { formatCurrencyBRL, formatDateBR } from '../utils'
import { AlertCircle, CheckCircle, Zap, Sparkles, Undo2, History, ExternalLink, RefreshCw } from 'lucide-react'

interface FiscalDocumentAccountingFormProps {
  doc: FiscalDocument
  chartAccounts: ChartAccount[]
  costCenters: { id: string; code: string; name: string }[]
  suggestion: FiscalAccountingSuggestion | null
  applications: FiscalAccountingApplication[]
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
const labelClass = 'text-xs font-semibold text-gray-600 block mb-1'

const MODE_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  RULE_SUGGESTED: 'Sugestão de regra',
  RULE_AUTO_DRAFT: 'Rascunho automático de regra'
}

function ApplicationHistory({ applications }: { applications: FiscalAccountingApplication[] }) {
  if (applications.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" />
        Histórico de Contabilizações
      </h3>
      <div className="space-y-2">
        {applications.map((app) => (
          <div key={app.id} className="border border-gray-100 rounded-lg p-3 text-xs space-y-1">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-[10px] ${
                app.status === 'APPLIED' ? 'bg-green-50 text-green-700' : app.status === 'REVERSED' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
              }`}>
                {app.status === 'APPLIED' ? 'Aplicado' : app.status === 'REVERSED' ? 'Estornado' : 'Erro'}
              </span>
              <span className="text-gray-400">{formatDateBR(app.created_at?.slice(0, 10))}</span>
            </div>
            <p className="text-gray-600">
              {MODE_LABELS[app.mode]}{app.rule?.name ? ` — regra "${app.rule.name}"` : ''}
            </p>
            {app.lines?.length ? (
              <div className="text-gray-500 space-y-0.5">
                {app.lines.map((line) => (
                  <p key={line.id}>
                    {DEBIT_CREDIT_LABELS[line.debit_credit]}: {line.account ? `${line.account.code} — ${line.account.name}` : '—'} · {formatCurrencyBRL(line.amount)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">
                D: {app.debit_account ? `${app.debit_account.code} — ${app.debit_account.name}` : '—'} · C: {app.credit_account ? `${app.credit_account.code} — ${app.credit_account.name}` : '—'} · {formatCurrencyBRL(app.amount)}
              </p>
            )}
            {app.journal_entry && (
              <p className="text-gray-500">
                Lançamento nº {app.journal_entry.number ?? '—'} ({app.journal_entry.status})
              </p>
            )}
            {app.status === 'REVERSED' && app.reversal_journal_entry && (
              <p className="text-amber-700">
                Estornado em {app.reversed_at ? formatDateBR(app.reversed_at.slice(0, 10)) : '—'} — lançamento de reversão nº {app.reversal_journal_entry.number ?? '—'}
              </p>
            )}
            {app.error_message && <p className="text-red-600">{app.error_message}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function FiscalDocumentAccountingForm({ doc, chartAccounts, costCenters, suggestion, applications }: FiscalDocumentAccountingFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [useManual, setUseManual] = useState(!suggestion)
  const [debitAccountId, setDebitAccountId] = useState('')
  const [creditAccountId, setCreditAccountId] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [reverseReason, setReverseReason] = useState('')
  const [showReverseForm, setShowReverseForm] = useState(false)
  const [regenerateReason, setRegenerateReason] = useState('')
  const [showRegenerateForm, setShowRegenerateForm] = useState(false)

  const eligible = chartAccounts.filter((a) => a.accepts_entries && !a.is_synthetic && a.is_active)
  const isInbound = doc.direction === 'IN'
  const suggestionBalanced = suggestion ? suggestion.lines.length > 0 && Math.abs(suggestion.debitTotal - suggestion.creditTotal) <= 0.009 : false

  function handleSubmitRule() {
    if (!suggestion) return
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await accountFiscalDocumentAction({ id: doc.id, ruleId: suggestion.ruleId, costCenterId })
      if (res.ok) {
        setSuccessMsg(res.message || 'Documento contabilizado.')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  function handleSubmitManual(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await accountFiscalDocumentAction({ id: doc.id, debitAccountId, creditAccountId, costCenterId })
      if (res.ok) {
        setSuccessMsg(res.message || 'Documento contabilizado.')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  function handleReverse(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await reverseFiscalDocumentAccountingAction({ id: doc.id, reason: reverseReason })
      if (res.ok) {
        setSuccessMsg(res.message || 'Contabilização estornada.')
        setShowReverseForm(false)
        setReverseReason('')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  function handleRegenerate(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await regenerateFiscalDocumentAccountingAction({
        id: doc.id,
        reason: regenerateReason,
        ruleId: suggestion && !useManual ? suggestion.ruleId : undefined,
        debitAccountId: suggestion && !useManual ? undefined : debitAccountId,
        creditAccountId: suggestion && !useManual ? undefined : creditAccountId,
        costCenterId
      })
      if (res.ok) {
        setSuccessMsg(res.message || 'Contabilização regerada.')
        setShowRegenerateForm(false)
        setRegenerateReason('')
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  if (doc.status !== 'BOOKED' && doc.accounting_status !== 'ACCOUNTED') {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-xs text-amber-800">
          <p className="font-semibold mb-1">Pendente de contabilização</p>
          O documento precisa estar <strong>Escriturado</strong> antes de ser contabilizado (status atual: {doc.status}).
        </div>
        <ApplicationHistory applications={applications} />
      </div>
    )
  }

  if (doc.accounting_status === 'ACCOUNTED') {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-bold text-green-800 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              Documento Contabilizado
            </p>
            {doc.journal_entry?.number && (
              <Link href="/contabilidade/lancamentos" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
                Ver lançamento nº {doc.journal_entry.number}
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
          {applications[0] && (
            <div className="text-xs text-green-800 space-y-1">
              <p>Modo: <strong>{MODE_LABELS[applications[0].mode]}</strong>{applications[0].rule?.name ? ` (regra "${applications[0].rule.name}")` : ''}</p>
              {applications[0].lines?.length ? (
                <div className="space-y-0.5">
                  {applications[0].lines.map((line) => (
                    <p key={line.id}>
                      {DEBIT_CREDIT_LABELS[line.debit_credit]}: {line.account ? `${line.account.code} — ${line.account.name}` : '—'} · {formatCurrencyBRL(line.amount)}
                    </p>
                  ))}
                </div>
              ) : (
                <p>
                  Débito: {applications[0].debit_account ? `${applications[0].debit_account.code} — ${applications[0].debit_account.name}` : '—'} ·
                  {' '}Crédito: {applications[0].credit_account ? `${applications[0].credit_account.code} — ${applications[0].credit_account.name}` : '—'}
                </p>
              )}
              <p>Valor: <strong>{formatCurrencyBRL(applications[0].amount)}</strong></p>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-green-100 border border-green-300 text-green-900 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
              <CheckCircle className="w-4 h-4 text-green-700 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {!showReverseForm && !showRegenerateForm && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowReverseForm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 hover:bg-amber-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Estornar Contabilização
              </button>
              <button
                type="button"
                onClick={() => setShowRegenerateForm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-300 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regerar Contabilização
              </button>
            </div>
          )}

          {showReverseForm && (
            <form onSubmit={handleReverse} className="space-y-2 border-t border-green-200 pt-3">
              <label className="text-xs font-semibold text-green-900 block">Motivo do estorno *</label>
              <input className={inputClass} value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} required minLength={3} placeholder="Ex.: conta errada, lançar de novo" />
              <div className="flex gap-2">
                <button type="submit" disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
                  {isPending ? 'Estornando...' : 'Confirmar Estorno'}
                </button>
                <button type="button" onClick={() => setShowReverseForm(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">Cancelar</button>
              </div>
            </form>
          )}

          {showRegenerateForm && (
            <form onSubmit={handleRegenerate} className="space-y-3 border-t border-green-200 pt-3">
              <p className="text-[11px] text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg p-2">
                Estorna o lançamento atual e já gera o novo em seguida, com a regra/contas abaixo. As duas operações ficam registradas no histórico.
              </p>
              <div>
                <label className="text-xs font-semibold text-green-900 block mb-1">Motivo da regeração *</label>
                <input className={inputClass} value={regenerateReason} onChange={(e) => setRegenerateReason(e.target.value)} required minLength={3} placeholder="Ex.: conta errada, aplicar nova regra contábil" />
              </div>

              {suggestion && !useManual ? (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-indigo-800">
                    Vai usar a regra <strong>&quot;{suggestion.ruleName}&quot;</strong> ({formatCurrencyBRL(suggestion.debitTotal)}).
                  </p>
                  <button type="button" onClick={() => setUseManual(true)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">
                    Ajustar manualmente
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Conta de Débito *</label>
                    <select className={inputClass} value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)} required>
                      <option value="">— Selecione —</option>
                      {eligible.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Conta de Crédito *</label>
                    <select className={inputClass} value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)} required>
                      <option value="">— Selecione —</option>
                      {eligible.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </div>
                  {suggestion && (
                    <button type="button" onClick={() => setUseManual(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer sm:col-span-2 text-left">
                      Voltar para sugestão da regra
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending || !regenerateReason || (!(suggestion && !useManual) && (!debitAccountId || !creditAccountId))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Regerando...' : 'Confirmar e Regerar'}
                </button>
                <button type="button" onClick={() => setShowRegenerateForm(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">Cancelar</button>
              </div>
            </form>
          )}
        </div>
        <ApplicationHistory applications={applications} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-xs font-semibold flex gap-2 items-start">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {suggestion && !useManual && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Sugestão de Contabilização — Regra &quot;{suggestion.ruleName}&quot;
          </h3>
          <p className="text-xs text-indigo-700">{suggestion.explanation}</p>
          <div className="border border-indigo-100 rounded-lg overflow-hidden text-xs bg-white">
            {suggestion.lines.map((line, index) => (
              <div key={`${line.debitCredit}-${line.accountName}-${index}`} className="grid grid-cols-1 sm:grid-cols-[90px_1fr_150px] gap-2 p-3 border-b border-indigo-50 last:border-b-0">
                <span className="font-bold text-indigo-800">{DEBIT_CREDIT_LABELS[line.debitCredit]}</span>
                <span className="font-semibold text-gray-800">{line.accountName}</span>
                <span className="font-mono font-bold text-gray-800 sm:text-right">{formatCurrencyBRL(line.amount)}</span>
                <span className="sm:col-span-3 text-[11px] text-gray-400">
                  Base: {VALUE_BASE_LABELS[line.valueBase]} x {line.amountMultiplier} · {line.memo}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-indigo-50 text-indigo-900 font-bold">
              <span>Débitos: {formatCurrencyBRL(suggestion.debitTotal)}</span>
              <span className="sm:text-right">Créditos: {formatCurrencyBRL(suggestion.creditTotal)}</span>
            </div>
          </div>
          <div className="text-xs text-indigo-800">
            Histórico padrão: <span className="font-semibold">{suggestion.description}</span>
          </div>
          {suggestion.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-0.5">
              {suggestion.warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-amber-700">• {w}</p>
              ))}
            </div>
          )}
          <div>
            <label className={labelClass}>Centro de Custo (opcional)</label>
            <select className={inputClass} value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
              <option value="">— Nenhum —</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmitRule}
              disabled={isPending || !suggestionBalanced}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              {isPending ? 'Contabilizando...' : 'Confirmar e Contabilizar pela Regra'}
            </button>
            <button type="button" onClick={() => setUseManual(true)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">
              Ajustar manualmente
            </button>
          </div>
        </div>
      )}

      {(!suggestion || useManual) && (
        <form onSubmit={handleSubmitManual} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {suggestion ? 'Contabilização Manual (ajuste da sugestão)' : 'Contabilizar Documento'}
          </h3>
          {!suggestion && (
            <p className="text-[11px] text-gray-400">
              Nenhuma regra contábil fiscal ativa casou com este documento —{' '}
              <Link href="/fiscal/regras-contabeis/novo" className="text-emerald-700 font-semibold hover:underline">crie uma regra</Link> ou contabilize manualmente abaixo.
            </p>
          )}
          <p className="text-[11px] text-gray-400">
            Valor total: <strong>{formatCurrencyBRL(doc.document_amount)}</strong>. {isInbound ? 'Entrada: débito na conta selecionada abaixo (despesa/estoque/ativo), crédito na contrapartida (fornecedor/passivo/banco).' : 'Saída: débito na contrapartida (cliente/banco), crédito na conta de receita selecionada abaixo.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Conta de Débito *</label>
              <select className={inputClass} value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)} required>
                <option value="">— Selecione —</option>
                {eligible.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Conta de Crédito *</label>
              <select className={inputClass} value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)} required>
                <option value="">— Selecione —</option>
                {eligible.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
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
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={isPending || !debitAccountId || !creditAccountId} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer">
              <Zap className="w-4 h-4" />
              {isPending ? 'Contabilizando...' : 'Gerar Lançamento Contábil'}
            </button>
            {suggestion && (
              <button type="button" onClick={() => setUseManual(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">
                Voltar para sugestão da regra
              </button>
            )}
          </div>
        </form>
      )}

      <ApplicationHistory applications={applications} />
    </div>
  )
}
