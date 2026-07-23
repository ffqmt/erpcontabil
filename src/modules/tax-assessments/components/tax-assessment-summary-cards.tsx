import React from 'react'
import { TaxAssessment } from '../types'
import { formatCurrencyBRL } from '../utils'

function Card({ label, value, tone, hint }: { label: string; value: string; tone?: 'default' | 'positive' | 'negative' | 'highlight'; hint?: string }) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-red-600' : tone === 'highlight' ? 'text-indigo-700' : 'text-gray-800'
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3.5">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide block">{label}</span>
      <span className={`font-mono font-bold text-sm block mt-1 ${toneClass}`}>{value}</span>
      {hint && <span className="text-[10px] text-gray-400 block mt-0.5">{hint}</span>}
    </div>
  )
}

// Composição completa da apuração (Etapa 24): deixa explícito o que é débito bruto, o que
// abate (crédito/retenção/saldo anterior), o que soma (ajustes/multa/juros) e o resultado
// final (a recolher OU saldo a transportar — nunca os dois ao mesmo tempo, ver fórmula em
// docs/tax-assessment-credits.md).
export function TaxAssessmentSummaryCards({ assessment }: { assessment: TaxAssessment }) {
  const hasNextBalance = Number(assessment.next_balance_amount || 0) > 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <Card label="Débitos" value={formatCurrencyBRL(assessment.debit_amount)} hint="Documentos de saída" />
      <Card label="Créditos" value={formatCurrencyBRL(assessment.credit_amount)} tone="positive" hint="Documentos de entrada + manuais" />
      <Card label="Retenções" value={formatCurrencyBRL(assessment.retained_amount)} hint="Retido na fonte" />
      <Card label="Saldo Anterior" value={formatCurrencyBRL(assessment.previous_balance_amount)} tone="positive" hint="Crédito do período anterior" />
      <Card label="Ajustes" value={formatCurrencyBRL(assessment.adjustment_amount)} hint="Manuais (+ / -)" />
      <Card label="Multa" value={formatCurrencyBRL(assessment.fine_amount)} />
      <Card label="Juros" value={formatCurrencyBRL(assessment.interest_amount)} />
      {hasNextBalance ? (
        <Card label="Saldo a Transportar" value={formatCurrencyBRL(assessment.next_balance_amount)} tone="highlight" hint="Vira crédito do próximo período" />
      ) : (
        <Card label="A Recolher" value={formatCurrencyBRL(assessment.payable_amount)} tone={Number(assessment.payable_amount) > 0 ? 'negative' : 'default'} />
      )}
    </div>
  )
}
