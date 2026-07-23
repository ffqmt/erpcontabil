'use client'

import React from 'react'
import { AccountingDashboardData } from '../types'
import { AccountingStatusCard } from './accounting-status-card'
import { AccountingAlerts } from './accounting-alerts'
import { AccountingKpiCard } from './accounting-kpi-card'
import { RecentJournalEntries } from './recent-journal-entries'
import { AccountingShortcuts } from './accounting-shortcuts'
import { formatCurrencyBRL } from '../dashboard-utils'
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Scale, 
  Calculator,
  Activity,
  ShieldCheck,
  ShieldAlert,
  FileText
} from 'lucide-react'

interface AccountingDashboardProps {
  data: AccountingDashboardData
}

export function AccountingDashboard({ data }: AccountingDashboardProps) {
  const {
    competence,
    periodStatus,
    hasClosing,
    closingEntryNumber,
    draftsCount,
    postedCount,
    reversedCount,
    totalEntries,
    recentEntries,
    dre,
    balanceSheet,
    alerts
  } = data

  const isProfit = dre.netProfit >= 0
  const isBsBalanced = balanceSheet.isBalanced

  // Cálculo da Margem Líquida
  const netRevenue = dre.grossRevenue - dre.deductionsTotal
  const marginPct = netRevenue > 0 ? (dre.netProfit / netRevenue) * 100 : 0

  return (
    <div className="space-y-6">
      {/* 1. Primeira Linha: Status Competência + Alertas Operacionais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-1">
          <AccountingStatusCard
            competence={competence}
            periodStatus={periodStatus}
            hasClosing={hasClosing}
            closingEntryNumber={closingEntryNumber}
          />
        </div>
        <div className="lg:col-span-2">
          <AccountingAlerts alerts={alerts} />
        </div>
      </div>

      {/* 2. Segunda Linha: KPIs do Resultado (DRE) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4.5 h-4.5 text-gray-400" />
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider font-sans">
            Desempenho Econômico do Mês (DRE)
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <AccountingKpiCard
            title="Receita Bruta (+)"
            value={formatCurrencyBRL(dre.grossRevenue)}
            subtext="Faturamento bruto acumulado"
            icon={Coins}
            theme="green"
          />
          <AccountingKpiCard
            title="Deduções & Custos (-)"
            value={formatCurrencyBRL(dre.deductionsTotal + dre.costsTotal)}
            subtext="Tributos, devoluções e produção"
            icon={ArrowDownRight}
            theme="red"
          />
          <AccountingKpiCard
            title="Despesas Operacionais (-)"
            value={formatCurrencyBRL(dre.expensesTotal)}
            subtext="Administrativas, vendas e financeiras"
            icon={ArrowDownRight}
            theme="red"
          />
          <AccountingKpiCard
            title={isProfit ? "Lucro Líquido (=)" : "Prejuízo Líquido (=)"}
            value={formatCurrencyBRL(Math.abs(dre.netProfit))}
            subtext={`Margem líquida apurada: ${marginPct.toFixed(1)}%`}
            icon={isProfit ? TrendingUp : TrendingDown}
            theme={isProfit ? "green" : "red"}
          />
        </div>
      </div>

      {/* 3. Terceira Linha: Situação Patrimonial (Balanço) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4.5 h-4.5 text-gray-400" />
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider font-sans">
            Balanço e Lacre Patrimonial (Acumulado)
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <AccountingKpiCard
            title="Ativo Total"
            value={formatCurrencyBRL(balanceSheet.totalAssets)}
            subtext="Bens e direitos da empresa"
            icon={Calculator}
            theme="blue"
          />
          <AccountingKpiCard
            title="Passivo Total"
            value={formatCurrencyBRL(balanceSheet.totalLiabilities)}
            subtext="Obrigações e dívidas com terceiros"
            icon={Calculator}
            theme="red"
          />
          <AccountingKpiCard
            title="Patrimônio Líquido"
            value={formatCurrencyBRL(balanceSheet.totalEquity)}
            subtext={hasClosing ? "Inclui resultado já integrado" : "Inclui resultado líquido calculado"}
            icon={Calculator}
            theme="purple"
          />
          <AccountingKpiCard
            title="Lacre do Balanço"
            value={isBsBalanced ? "Balanced" : formatCurrencyBRL(Math.abs(balanceSheet.difference))}
            subtext={isBsBalanced ? "Ativo = Passivo + PL" : "Há diferença de partida dobrada"}
            icon={isBsBalanced ? ShieldCheck : ShieldAlert}
            theme={isBsBalanced ? "green" : "red"}
          />
        </div>
      </div>

      {/* 4. Quarta Linha: Últimos Lançamentos + Atalhos para Rotinas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <RecentJournalEntries entries={recentEntries} />
        </div>
        <div>
          <AccountingShortcuts periodStatus={periodStatus} />
        </div>
      </div>
    </div>
  )
}
