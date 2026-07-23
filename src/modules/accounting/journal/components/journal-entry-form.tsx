'use client'

import React, { useState, useTransition } from 'react'
import { ChartAccount } from '../../accounts/types'
import { JournalLineEditor, EditableJournalLine } from './journal-line-editor'
import { AccountSelect } from './account-select'
import { createManualJournalEntryAction } from '../actions'
import { AlertCircle, CheckCircle, Save, X } from 'lucide-react'

interface PartnerOption {
  id: string
  name: string
}

export interface JournalEntryFormInitialValues {
  entryDate: string
  description: string
  document: string
  partnerId: string
  lines: EditableJournalLine[]
}

interface JournalEntryFormProps {
  accounts: ChartAccount[]
  partners: PartnerOption[]
  competence: string
  onClose: () => void
  onSuccess: () => void
  initialValues?: JournalEntryFormInitialValues
}

type EntryMode = 'SIMPLE' | 'MULTIPLE'

export function JournalEntryForm({ accounts, partners, competence, onClose, onSuccess, initialValues }: JournalEntryFormProps) {
  const [isPending, startTransition] = useTransition()
  // Ao abrir pré-preenchido (Copiar Último / Duplicar — Etapa 30A), inicia sempre em Partida
  // Múltipla: representa corretamente tanto o caso de 2 linhas quanto o de N linhas, sem
  // precisar decidir heuristicamente se "cabe" no modo simples.
  const [mode, setMode] = useState<EntryMode>(initialValues ? 'MULTIPLE' : 'SIMPLE')

  // Cabeçalho (comum aos dois modos)
  const [entryDate, setEntryDate] = useState(initialValues?.entryDate || competence)
  const [description, setDescription] = useState(initialValues?.description || '')
  const [documentNumber, setDocumentNumber] = useState(initialValues?.document || '')
  const [partnerId, setPartnerId] = useState(initialValues?.partnerId || '')

  // Modo Partida Simples
  const [debitAccountId, setDebitAccountId] = useState('')
  const [creditAccountId, setCreditAccountId] = useState('')
  const [simpleAmount, setSimpleAmount] = useState(0)

  // Modo Partida Múltipla
  const [lines, setLines] = useState<EditableJournalLine[]>(
    initialValues?.lines || [
      { id: crypto.randomUUID(), accountId: '', debitCredit: 'DEBIT', amount: 0, memo: '' },
      { id: crypto.randomUUID(), accountId: '', debitCredit: 'CREDIT', amount: 0, memo: '' }
    ]
  )

  // Tratamentos de erros e feedbacks
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [lineErrors, setLineErrors] = useState<(string[] | null)[]>([])
  const [devRawError, setDevRawError] = useState<unknown>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const multiSummary = React.useMemo(() => {
    let debits = 0
    let credits = 0
    lines.forEach((line) => {
      const val = parseFloat(line.amount as any) || 0
      if (line.debitCredit === 'DEBIT') debits += val
      else credits += val
    })
    const difference = Math.abs(debits - credits)
    return { debits, credits, difference, isBalanced: difference < 0.01 && lines.length >= 2 }
  }, [lines])

  function buildLinesPayload(): { accountId: string; debitCredit: 'DEBIT' | 'CREDIT'; amount: number; memo: string | null }[] {
    if (mode === 'SIMPLE') {
      return [
        { accountId: debitAccountId, debitCredit: 'DEBIT', amount: simpleAmount, memo: description || null },
        { accountId: creditAccountId, debitCredit: 'CREDIT', amount: simpleAmount, memo: description || null }
      ]
    }
    return lines.map((l) => ({ accountId: l.accountId, debitCredit: l.debitCredit, amount: l.amount, memo: l.memo || null }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError(null)
    setFieldErrors({})
    setLineErrors([])
    setDevRawError(null)
    setSuccessMsg(null)

    if (!description || description.trim().length < 3) {
      setGeneralError('O histórico contábil geral deve conter pelo menos 3 caracteres.')
      return
    }

    if (mode === 'SIMPLE') {
      if (!debitAccountId || !creditAccountId) {
        setGeneralError('Selecione a conta de débito e a conta de crédito.')
        return
      }
      if (debitAccountId === creditAccountId) {
        setGeneralError('A conta de débito não pode ser igual à conta de crédito.')
        return
      }
      if (!simpleAmount || simpleAmount <= 0) {
        setGeneralError('Informe um valor maior que zero.')
        return
      }
    } else {
      if (lines.some((l) => !l.accountId || l.amount <= 0)) {
        setGeneralError('Todas as pernas contábeis devem conter uma conta selecionada e valor maior que zero.')
        return
      }
      if (!multiSummary.isBalanced) {
        setGeneralError('Lançamento desequilibrado. A soma dos débitos deve ser igual à dos créditos.')
        return
      }
    }

    startTransition(async () => {
      const payload = {
        entryDate,
        description,
        document: documentNumber || undefined,
        partnerId: partnerId || undefined,
        lines: buildLinesPayload()
      }

      const res = await createManualJournalEntryAction(payload)

      if (res.ok) {
        setSuccessMsg(res.message || 'Lançamento salvo como Rascunho!')
        setTimeout(() => onSuccess(), 1200)
      } else {
        setGeneralError(res.error)
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors)
          // fieldErrors.lines vem de Zod (.flatten()) como um array paralelo às linhas
          // enviadas — cada posição tem os erros daquela linha específica ou undefined.
          // Antes esse array existia mas nunca era exibido: o usuário só via o banner
          // genérico "Erros de validação nos campos do formulário." sem saber qual perna
          // estava errada. Agora é mapeado de volta para cada linha na UI.
          const rawLineErrors = (res.fieldErrors as any).lines
          if (Array.isArray(rawLineErrors)) setLineErrors(rawLineErrors)
        }
        if (process.env.NODE_ENV === 'development') {
          setDevRawError(res)
        }
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-md p-6 space-y-6">
      {/* Título & Fechar */}
      <div className="flex items-center justify-between border-b border-gray-150 pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">{initialValues ? 'Novo Lançamento (copiado)' : 'Novo Lançamento Manual'}</h3>
          <p className="text-xs text-gray-500">
            {initialValues
              ? 'Campos pré-preenchidos a partir de outro lançamento — revise antes de salvar. Mantenha o balanceamento (Débito = Crédito).'
              : 'Insira o lançamento e mantenha o balanceamento (Débito = Crédito).'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-650 p-1.5 hover:bg-gray-50 rounded-lg transition-colors" title="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Alternador de Modo */}
      <div className="flex border border-gray-200 rounded-lg overflow-hidden w-fit bg-gray-50 p-0.5">
        <button
          type="button"
          onClick={() => setMode('SIMPLE')}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'SIMPLE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Partida Simples
        </button>
        <button
          type="button"
          onClick={() => setMode('MULTIPLE')}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'MULTIPLE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Partida Múltipla
        </button>
      </div>

      {/* Feedbacks de Operação */}
      {generalError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-sm flex gap-2.5 items-start">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed font-semibold">{generalError}</div>
        </div>
      )}

      {devRawError !== null && (
        <div className="bg-gray-900 text-gray-200 p-3 rounded-lg text-[11px] font-mono overflow-x-auto">
          <div className="text-amber-400 font-bold mb-1">DEV — resposta bruta da action (não aparece em produção):</div>
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(devRawError, null, 2)}</pre>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg text-sm flex gap-2.5 items-start">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed font-semibold">{successMsg}</div>
        </div>
      )}

      {/* Cabeçalho do Lançamento */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Data</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-gray-700 bg-white"
            required
          />
          {fieldErrors.entryDate && <span className="text-[10px] font-semibold text-red-600">{fieldErrors.entryDate[0]}</span>}
        </div>

        <div className="md:col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Histórico Contábil Geral</label>
          <input
            type="text"
            placeholder="Ex: Saldo Inicial de Caixa, Provisão de Frete, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-gray-700 bg-white"
            required
          />
          {fieldErrors.description && <span className="text-[10px] font-semibold text-red-600">{fieldErrors.description[0]}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Documento</label>
          <input
            type="text"
            placeholder="Nº nota, recibo..."
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-gray-700 bg-white"
          />
        </div>

        <div className="md:col-span-4 flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Parceiro (opcional)</label>
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            disabled={isPending}
            className="w-full md:w-1/3 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-gray-700 bg-white"
          >
            <option value="">— Nenhum —</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {fieldErrors.partnerId && <span className="text-[10px] font-semibold text-red-600">{fieldErrors.partnerId[0]}</span>}
        </div>
      </div>

      {mode === 'SIMPLE' ? (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-4">
          <h4 className="text-xs uppercase font-bold text-gray-500 tracking-wider">Partida Simples (1 débito / 1 crédito)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600">Conta Débito</label>
              <AccountSelect accounts={accounts} value={debitAccountId} onChange={setDebitAccountId} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600">Conta Crédito</label>
              <AccountSelect accounts={accounts} value={creditAccountId} onChange={setCreditAccountId} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={simpleAmount || ''}
                onChange={(e) => setSimpleAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-gray-800 bg-white"
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <JournalLineEditor accounts={accounts} lines={lines} onChange={setLines} />
          {lineErrors.some((e) => e && e.length > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              {lineErrors.map((errs, idx) => errs && errs.length > 0 ? (
                <p key={idx} className="text-xs text-red-700"><strong>Linha {idx + 1}:</strong> {errs.join(' ')}</p>
              ) : null)}
            </div>
          )}
        </>
      )}

      {/* Botões de Ação */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-150">
        <button type="button" onClick={onClose} disabled={isPending} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || (mode === 'MULTIPLE' && !multiSummary.isBalanced)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-semibold text-sm rounded-lg shadow transition-colors"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Salvando...' : 'Salvar Rascunho (DRAFT)'}
        </button>
      </div>
    </form>
  )
}
