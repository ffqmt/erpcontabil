'use client'

import React from 'react'
import { BalanceSheetReportData, BalanceSheetItem } from '../types'
import { BalanceSheetSummary } from './balance-sheet-summary'
import { BalanceSheetSection } from './balance-sheet-section'
import { formatCurrencyBRL, formatBalanceValue } from '../balance-sheet-utils'
import { FileText, ClipboardList, Info } from 'lucide-react'

interface BalanceSheetTableProps {
  data: BalanceSheetReportData
}

export function BalanceSheetTable({ data }: BalanceSheetTableProps) {
  const {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquityBeforeResult,
    netPeriodResult,
    totalEquity,
    totalLiabilitiesAndEquity,
    difference,
    isBalanced,
    hasClosing,
    closingEntryNumber
  } = data

  const isProfit = netPeriodResult >= 0

  // Mapeia e filtra itens do Ativo, Passivo e PL para a impressão (nível <= 4)
  const printAssets = React.useMemo(() => assets.filter((i) => i.level <= 4), [assets])
  const printLiabilities = React.useMemo(() => liabilities.filter((i) => i.level <= 4), [liabilities])
  
  // Mostra a linha calculada de "Resultado do Período" sempre que houver resultado
  // cumulativo ainda não encerrado (netPeriodResult != 0) — não só quando a competência
  // selecionada em si não tem encerramento. Uma competência anterior sem encerramento pode
  // deixar resultado pendente mesmo com a competência atual já encerrada.
  const hasPendingResult = Math.abs(netPeriodResult) > 0.005

  const printEquity = React.useMemo(() => {
    const list = equity.filter((i) => i.level <= 4)

    if (hasPendingResult) {
      const lastPlIndex = list.findLastIndex((i) => i.account_type === 'EQUITY')
      if (lastPlIndex !== -1) {
        const resSigned = -netPeriodResult
        const tempItem: BalanceSheetItem = {
          id: 'temp-res-per',
          code: '3.9.99',
          name: 'Resultado do Período',
          parent_id: 'temp-parent',
          account_type: 'EQUITY',
          normal_balance: 'CREDIT',
          level: 3,
          is_synthetic: false,
          is_active: true,
          debits: 0,
          credits: 0,
          signedAmount: resSigned,
          displayAmount: netPeriodResult
        }
        list.splice(lastPlIndex + 1, 0, tempItem)
      }
    }

    return list
  }, [equity, hasPendingResult, netPeriodResult])

  return (
    <div className="space-y-6">
      {/* Resumos superiores */}
      <div className="print:hidden">
        <BalanceSheetSummary
          totalAssets={totalAssets}
          totalLiabilities={totalLiabilities}
          totalEquity={totalEquity}
          netPeriodResult={netPeriodResult}
          totalLiabilitiesAndEquity={totalLiabilitiesAndEquity}
          difference={difference}
          isBalanced={isBalanced}
        />
      </div>

      {/* Banner Informativo sobre Encerramento físico */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-start gap-2.5 text-xs print:hidden">
        <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed font-medium">
          {hasClosing && !hasPendingResult ? (
            <span className="text-emerald-800">
              ✓ O resultado da competência foi encerrado e transferido fisicamente para o Patrimônio Líquido por meio do lançamento oficial <strong>Nº {closingEntryNumber}</strong>.
            </span>
          ) : hasClosing && hasPendingResult ? (
            <span className="text-amber-800">
              ⚠ Esta competência já foi encerrada (lançamento <strong>Nº {closingEntryNumber}</strong>), mas ainda há resultado acumulado de competência(s) anterior(es) sem encerramento contábil — veja a linha &quot;Resultado do Período&quot; abaixo.
            </span>
          ) : (
            <span className="text-amber-800">
              ⚠ Resultado do período exibido de forma calculada temporária — sem lançamento de encerramento contábil no banco.
            </span>
          )}
        </div>
      </div>

      {/* Relatório Contábil Vertical (Somente Tela) */}
      <div className="print:hidden bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Cabeçalho do Relatório */}
        <div className="p-5 border-b border-gray-200 bg-gray-50/30 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            Estrutura do Balanço Patrimonial
          </h3>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            Posição Acumulada
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border-spacing-0">
            <thead>
              <tr className="bg-gray-150/40 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3.5 w-32">Código</th>
                <th className="px-4 py-3.5">Estrutura Contábil / Descrição da Conta</th>
                <th className="px-4 py-3.5 text-right w-48">Saldo Final</th>
              </tr>
            </thead>

            {/* I. Seção do Ativo */}
            <BalanceSheetSection title="ATIVO TOTAL" items={assets} total={totalAssets} />

            {/* II. Seção do Passivo */}
            <BalanceSheetSection title="PASSIVO TOTAL" items={liabilities} total={totalLiabilities} />

            {/* III. Seção de PL */}
            <tbody className="divide-y divide-gray-100 bg-white">
              {/* Título do Grupo de PL */}
              <tr className="bg-gray-50/70 border-y border-gray-200 text-xs font-bold text-gray-800 uppercase tracking-wider">
                <td colSpan={2} className="px-4 py-3">
                  PATRIMÔNIO LÍQUIDO
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-900 font-bold">
                  {formatCurrencyBRL(totalEquityBeforeResult, true)}
                </td>
              </tr>

              {/* Contas de PL normais */}
              {equity.map((item) => (
                <tr key={item.id} className="text-gray-650 hover:bg-gray-50/20 border-b border-gray-105">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-800 tracking-wider">
                    {item.code}
                  </td>
                  <td className="px-4 py-2.5">
                    <div style={{ paddingLeft: `${(item.level - 1) * 16}px` }} className="flex items-center gap-1.5">
                      <span className="text-gray-300">↳</span>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-850">
                    {formatCurrencyBRL(item.displayAmount, true)}
                  </td>
                </tr>
              ))}

              {/* Linha Fictícia Calculada: Resultado do Período (cumulativo ainda não encerrado) */}
              {hasPendingResult && (
                <tr className="text-gray-650 hover:bg-gray-50/20 border-b border-gray-105 font-medium italic">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500 italic">
                    RES-PER
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="pl-4 flex flex-col">
                      <span className="text-gray-800 font-semibold flex items-center gap-1">
                        Resultado do Período
                      </span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        (linha calculada — resultado acumulado de competência(s) ainda sem encerramento contábil no banco)
                      </span>
                    </div>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${isProfit ? 'text-green-700 font-bold' : 'text-red-750 font-bold'}`}>
                    {formatCurrencyBRL(netPeriodResult, true)}
                  </td>
                </tr>
              )}

              {/* Subtotal do PL Consolidado */}
              <tr className="bg-gray-100/70 border-y border-gray-200 text-xs font-bold text-gray-800">
                <td colSpan={2} className="px-4 py-3.5 pl-8">
                  (=) TOTAL DO PATRIMÔNIO LÍQUIDO CONSOLIDADO
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-gray-900">
                  {formatCurrencyBRL(totalEquity, true)}
                </td>
              </tr>

              {/* Totalizador de Passivo + PL */}
              <tr className={`font-bold text-sm ${
                isBalanced 
                  ? 'bg-green-50/80 text-green-900 border-t border-green-200' 
                  : 'bg-red-50/80 text-red-950 border-t border-red-200'
              }`}>
                <td colSpan={2} className="px-4 py-4 text-left pl-8 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 flex-shrink-0" />
                  (=) TOTAL DO PASSIVO E PATRIMÔNIO LÍQUIDO
                </td>
                <td className="px-4 py-4 text-right font-mono text-base">
                  {formatCurrencyBRL(totalLiabilitiesAndEquity, true)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Relatório Contábil do Balanço (Exclusivo Impressão) */}
      <div className="hidden print:block select-none font-mono text-[9px] text-black">
        <table className="w-full text-left border-collapse print:table-fixed">
          <thead>
            <tr className="border-b border-black font-bold uppercase">
              <th className="px-2 py-1.5 text-[9px] print:w-[70%]">Descrição</th>
              <th className="px-2 py-1.5 text-right text-[9px] print:w-[30%]">Saldo Atual</th>
            </tr>
          </thead>
          <tbody>
            {/* ATIVO */}
            <tr className="font-bold">
              <td className="px-2 py-1.5 uppercase text-[9px]">ATIVO</td>
              <td className="px-2 py-1.5 text-right text-[9px] font-bold">{formatBalanceValue(totalAssets, totalAssets, 'ASSET')}</td>
            </tr>
            {/* Itens do Ativo */}
            {printAssets.map((item) => {
              if (item.level === 1) return null // Já impresso no cabeçalho
              const isSynth = item.is_synthetic
              const nameStyle = { paddingLeft: `${(item.level - 1) * 12}px` }
              return (
                <tr key={item.id} className={isSynth ? 'font-bold' : ''}>
                  <td className="px-2 py-1.5">
                    <div style={nameStyle} className="text-[9px]">{item.name}</div>
                  </td>
                  <td className="px-2 py-1.5 text-right text-[9px]">
                    {formatBalanceValue(item.displayAmount, item.signedAmount, item.account_type)}
                  </td>
                </tr>
              )
            })}

            {/* PASSIVO */}
            <tr className="font-bold border-t border-gray-300">
              <td className="px-2 py-1.5 uppercase text-[9px]">PASSIVO</td>
              <td className="px-2 py-1.5 text-right text-[9px] font-bold">{formatBalanceValue(totalLiabilitiesAndEquity, -totalLiabilitiesAndEquity, 'LIABILITY')}</td>
            </tr>
            {/* Itens do Passivo */}
            {printLiabilities.map((item) => {
              if (item.level === 1) return null // Já impresso no cabeçalho
              const isSynth = item.is_synthetic
              const nameStyle = { paddingLeft: `${(item.level - 1) * 12}px` }
              return (
                <tr key={item.id} className={isSynth ? 'font-bold' : ''}>
                  <td className="px-2 py-1.5">
                    <div style={nameStyle} className="text-[9px]">{item.name}</div>
                  </td>
                  <td className="px-2 py-1.5 text-right text-[9px]">
                    {formatBalanceValue(item.displayAmount, item.signedAmount, item.account_type)}
                  </td>
                </tr>
              )
            })}

            {/* PATRIMÔNIO LÍQUIDO */}
            <tr className="font-bold border-t border-gray-300">
              <td className="px-2 py-1.5 uppercase pl-3 text-[9px]">PATRIMÔNIO LÍQUIDO</td>
              <td className="px-2 py-1.5 text-right text-[9px] font-bold">{formatBalanceValue(totalEquity, -totalEquity, 'EQUITY')}</td>
            </tr>
            {/* Itens do PL */}
            {printEquity.map((item) => {
              if (item.level === 1) return null // Já impresso no cabeçalho
              const isSynth = item.is_synthetic
              const nameStyle = { paddingLeft: `${(item.level - 1) * 12}px` }
              return (
                <tr key={item.id} className={isSynth ? 'font-bold' : ''}>
                  <td className="px-2 py-1.5">
                    <div style={nameStyle} className="text-[9px]">{item.name}</div>
                  </td>
                  <td className="px-2 py-1.5 text-right text-[9px]">
                    {formatBalanceValue(item.displayAmount, item.signedAmount, item.account_type)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}


