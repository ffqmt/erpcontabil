'use client'

import React from 'react'
import { DreReportData } from '../types'
import { DreSummary } from './dre-summary'
import { DreSection } from './dre-section'
import { formatCurrencyBRL, formatDreValue } from '../dre-utils'
import { FileText, ClipboardCheck } from 'lucide-react'

interface DreTableProps {
  data: DreReportData
}

export function DreTable({ data }: DreTableProps) {
  const {
    sections,
    grossRevenue,
    deductionsTotal,
    netRevenue,
    costsTotal,
    grossProfit,
    expensesTotal,
    operatingProfit,
    taxTotal,
    netProfit,
    netMargin
  } = data

  const isProfit = netProfit >= 0

  return (
    <div className="space-y-6">
      {/* Cards Estatísticos */}
      <div className="print:hidden">
        <DreSummary
          grossRevenue={grossRevenue}
          netRevenue={netRevenue}
          grossProfit={grossProfit}
          expensesTotal={expensesTotal + taxTotal} // Totalizando custos de saída/despesa e impostos
          netProfit={netProfit}
          netMargin={netMargin}
        />
      </div>

      {/* Relatório Contábil da DRE */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {/* Cabeçalho do Livro */}
        <div className="p-5 border-b border-gray-200 bg-gray-50/30 flex items-center justify-between print:hidden">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            Estrutura da Demonstração do Resultado
          </h3>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            Regime de Competência
          </span>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left border-collapse border-spacing-0 print:font-mono print:table-fixed">
            <thead>
              <tr className="bg-gray-150/40 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider print:bg-transparent print:border-b-2 print:border-black print:text-black">
                <th className="px-4 py-3.5 w-32 print:hidden">Código</th>
                <th className="px-4 py-3.5 print:w-[50%]"><span className="print:hidden">Estrutura Contábil / Descrição</span><span className="hidden print:inline print:text-[9px] print:font-bold">Descrição</span></th>
                <th className="px-4 py-3.5 text-right w-48 print:hidden">Valor Apurado</th>
                <th className="hidden print:table-cell px-4 py-3.5 text-right w-36 font-bold print:w-[25%] print:text-[9px]">Saldo</th>
                <th className="hidden print:table-cell px-4 py-3.5 text-right w-36 font-bold print:w-[25%] print:text-[9px]">Total</th>
              </tr>
            </thead>

            {/* 1. Receita Bruta */}
            <DreSection section={sections.revenue} prefixSymbol="+" />

            {/* 2. Deduções da Receita */}
            <DreSection section={sections.deductions} prefixSymbol="-" />

            {/* Subtotal: Receita Líquida */}
            <tbody>
              <tr className="bg-gray-100 font-bold border-y border-gray-200 text-xs text-gray-800 print:bg-transparent print:text-black print:border-y print:border-black">
                <td colSpan={2} className="px-4 py-3.5 pl-8 print:hidden">
                  (=) RECEITA OPERACIONAL LÍQUIDA
                </td>
                <td className="hidden print:table-cell px-4 py-2 font-bold text-[9px] uppercase">
                  (=) RECEITA OPERACIONAL LÍQUIDA
                </td>
                <td className="hidden print:table-cell px-4 py-2 text-right"></td>
                <td className="px-4 py-3.5 text-right font-mono text-gray-900 print:text-black print:text-[9px] print:font-bold">
                  <span className="print:hidden">{formatCurrencyBRL(netRevenue)}</span>
                  <span className="hidden print:inline border-b border-black pb-0.5">{formatDreValue(netRevenue)}</span>
                </td>
              </tr>
            </tbody>

            {/* 3. Custos Operacionais */}
            <DreSection section={sections.costs} prefixSymbol="-" />

            {/* Subtotal: Lucro Bruto */}
            <tbody>
              <tr className="bg-gray-100 font-bold border-y border-gray-200 text-xs text-gray-800 print:bg-transparent print:text-black print:border-y print:border-black">
                <td colSpan={2} className="px-4 py-3.5 pl-8 print:hidden">
                  (=) LUCRO BRUTO OPERACIONAL
                </td>
                <td className="hidden print:table-cell px-4 py-2 font-bold text-[9px] uppercase">
                  (=) LUCRO BRUTO OPERACIONAL
                </td>
                <td className="hidden print:table-cell px-4 py-2 text-right"></td>
                <td className="px-4 py-3.5 text-right font-mono text-gray-900 print:text-black print:text-[9px] print:font-bold">
                  <span className="print:hidden">{formatCurrencyBRL(grossProfit)}</span>
                  <span className="hidden print:inline border-b border-black pb-0.5">{formatDreValue(grossProfit)}</span>
                </td>
              </tr>
            </tbody>

            {/* 4. Despesas Operacionais */}
            <DreSection section={sections.expenses} prefixSymbol="-" />

            {/* Subtotal: Resultado Operacional */}
            <tbody>
              <tr className="bg-gray-100 font-bold border-y border-gray-200 text-xs text-gray-800 print:bg-transparent print:text-black print:border-y print:border-black">
                <td colSpan={2} className="px-4 py-3.5 pl-8 print:hidden">
                  (=) RESULTADO ANTES DOS IMPOSTOS (EBITDA)
                </td>
                <td className="hidden print:table-cell px-4 py-2 font-bold text-[9px] uppercase">
                  (=) RESULTADO ANTES DOS IMPOSTOS (EBITDA)
                </td>
                <td className="hidden print:table-cell px-4 py-2 text-right"></td>
                <td className="px-4 py-3.5 text-right font-mono text-gray-900 print:text-black print:text-[9px] print:font-bold">
                  <span className="print:hidden">{formatCurrencyBRL(operatingProfit, true)}</span>
                  <span className="hidden print:inline border-b border-black pb-0.5">{formatDreValue(operatingProfit)}</span>
                </td>
              </tr>
            </tbody>

            {/* 5. Impostos IRPJ / CSLL */}
            <DreSection section={sections.tax} prefixSymbol="-" />

            {/* Resultado Final: Lucro Líquido */}
            <tbody>
              <tr className={`font-bold border-t border-gray-200 text-sm print:text-black print:border-t-2 print:border-black ${
                isProfit 
                  ? 'bg-green-50/80 text-green-900 print:bg-transparent' 
                  : 'bg-red-50/80 text-red-950 print:bg-transparent'
              }`}>
                <td colSpan={2} className="px-4 py-4 text-left pl-8 flex items-center gap-2 print:hidden">
                  <ClipboardCheck className="w-5 h-5 flex-shrink-0" />
                  (=) RESULTADO LÍQUIDO DO PERÍODO
                </td>
                <td className="hidden print:table-cell px-4 py-3 font-bold text-[9px] uppercase">
                  {isProfit ? '(=) LUCRO LIQUIDO DO PERÍODO' : '(=) PREJUÍZO DO EXERCÍCIO'}
                </td>
                <td className="hidden print:table-cell px-4 py-3 text-right"></td>
                <td className={`px-4 py-4 text-right font-mono text-base print:text-[9px] print:font-bold ${
                  isProfit ? 'text-green-700' : 'text-red-750'
                }`}>
                  <span className="print:hidden">{formatCurrencyBRL(netProfit, true)}</span>
                  <span className="hidden print:inline border-b border-black pb-0.5">{formatDreValue(netProfit)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
