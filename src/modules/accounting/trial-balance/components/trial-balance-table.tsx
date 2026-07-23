'use client'

import React, { useState, useMemo } from 'react'
import { TrialBalanceItem } from '../types'
import { TrialBalanceFilters, TrialFilterState } from './trial-balance-filters'
import { TrialBalanceSummary } from './trial-balance-summary'
import { TrialBalanceRow } from './trial-balance-row'
import { formatCurrencyBRL, formatNumberBRL } from '../trial-balance-utils'
import { Calculator, CheckCircle2, AlertTriangle, Info } from 'lucide-react'

interface TrialBalanceTableProps {
  items: TrialBalanceItem[]
}

export function TrialBalanceTable({ items }: TrialBalanceTableProps) {
  const [filters, setFilters] = useState<TrialFilterState>({
    search: '',
    type: '',
    isSynthetic: '',
    hideZeroBalances: true // Inicia ocultando contas zeradas para melhor legibilidade
  })

  // Adiciona a sequência numérica original de cada conta antes de qualquer filtro
  const itemsWithSequence = useMemo(() => {
    return items.map((item, index) => ({
      ...item,
      sequenceNumber: index + 1
    }))
  }, [items])

  // Calcula os totais das contas Devedoras e Credoras para o RESUMO DO BALANCETE
  const resumoTotals = useMemo(() => {
    const devedoras = itemsWithSequence.filter(
      (i) => !i.is_synthetic && (i.finalNature === 'D' || (i.finalBalance === 0 && i.normal_balance === 'DEBIT'))
    )
    const credoras = itemsWithSequence.filter(
      (i) => !i.is_synthetic && (i.finalNature === 'C' || (i.finalBalance === 0 && i.normal_balance === 'CREDIT'))
    )

    const sumGroup = (group: typeof itemsWithSequence) => {
      let ant = 0
      let deb = 0
      let cre = 0
      let fin = 0
      group.forEach((i) => {
        ant += i.initialBalance
        deb += i.periodDebits
        cre += i.periodCredits
        fin += i.finalBalance
      })
      return { ant, deb, cre, fin }
    }

    return {
      devedoras: sumGroup(devedoras),
      credoras: sumGroup(credoras)
    }
  }, [itemsWithSequence])

  // Calcula resumos considerando APENAS as contas contábeis ANALÍTICAS para evitar dupla contagem
  const summaryStats = useMemo(() => {
    const analyticItems = itemsWithSequence.filter((item) => !item.is_synthetic)
    
    let periodDebits = 0
    let periodCredits = 0
    let finalDebits = 0
    let finalCredits = 0
    let activeCount = 0

    analyticItems.forEach((item) => {
      const hasMov = item.periodDebits > 0.005 || item.periodCredits > 0.005
      const hasBal = item.initialBalance > 0.005 || item.finalBalance > 0.005
      
      if (hasMov || hasBal) {
        activeCount++
      }

      periodDebits += item.periodDebits
      periodCredits += item.periodCredits

      if (item.finalNature === 'D') {
        finalDebits += item.finalBalance
      } else {
        finalCredits += item.finalBalance
      }
    })

    return {
      periodDebits,
      periodCredits,
      finalDebits,
      finalCredits,
      activeCount
    }
  }, [items])

  // Filtra as contas contábeis dinamicamente conforme seleção do usuário
  const filteredItems = useMemo(() => {
    return itemsWithSequence.filter((item) => {
      const isZero = item.initialBalance < 0.005 && 
                     item.periodDebits < 0.005 && 
                     item.periodCredits < 0.005 && 
                     item.finalBalance < 0.005

      // 1. Filtro Ocultar Zeradas
      if (filters.hideZeroBalances && isZero) {
        return false
      }

      // 2. Filtro Busca (Código ou Nome)
      if (filters.search) {
        const term = filters.search.toLowerCase()
        const matchCode = item.code.toLowerCase().includes(term)
        const matchName = item.name.toLowerCase().includes(term)
        if (!matchCode && !matchName) return false
      }

      // 3. Filtro Tipo de Conta
      if (filters.type && item.account_type !== filters.type) {
        return false
      }

      // 4. Filtro de Estrutura (Sintética / Analítica)
      if (filters.isSynthetic !== '') {
        const filterVal = filters.isSynthetic === 'true'
        if (item.is_synthetic !== filterVal) return false
      }

      return true
    })
  }, [items, filters])

  // Calcula totais da tabela no rodapé (para a lista de contas sendo exibida na tela)
  const tableFooterTotals = useMemo(() => {
    // Para o rodapé da tabela, somamos apenas as contas de Nível 1 (raiz) exibidas, 
    // ou apenas as analíticas filtradas se houver filtros ativos.
    // A melhor prática de rodapé de Balancete é exibir a soma de todas as contas analíticas.
    const targets = filteredItems.filter((i) => !i.is_synthetic)
    
    let antDeb = 0
    let antCre = 0
    let perDeb = 0
    let perCre = 0
    let finDeb = 0
    let finCre = 0

    targets.forEach((i) => {
      // Saldo anterior
      if (i.initialNature === 'D') {
        antDeb += i.initialBalance
      } else {
        antCre += i.initialBalance
      }

      // Período
      perDeb += i.periodDebits
      perCre += i.periodCredits

      // Saldo final
      if (i.finalNature === 'D') {
        finDeb += i.finalBalance
      } else {
        finCre += i.finalBalance
      }
    })

    return {
      antDeb,
      antCre,
      perDeb,
      perCre,
      finDeb,
      finCre
    }
  }, [filteredItems])

  const footerDiff = Math.abs(tableFooterTotals.finDeb - tableFooterTotals.finCre)
  const isFooterBalanced = footerDiff < 0.01

  return (
    <div className="space-y-6">
      {/* Resumos Estatísticos do Período */}
      <div className="print:hidden">
        <TrialBalanceSummary
          periodDebits={summaryStats.periodDebits}
          periodCredits={summaryStats.periodCredits}
          finalDebits={summaryStats.finalDebits}
          finalCredits={summaryStats.finalCredits}
          activeCount={summaryStats.activeCount}
        />
      </div>

      {/* Filtros */}
      <div className="print:hidden">
        <TrialBalanceFilters onFilterChange={setFilters} />
      </div>

      {/* Tabela do Balancete */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {filteredItems.length > 0 ? (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left border-collapse print:font-mono print:table-fixed">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider print:bg-transparent print:border-b-2 print:border-black print:text-black">
                  <th className="px-4 py-3.5 w-32 print:w-[6%] print:text-[9px] print:font-bold">Código</th>
                  <th className="hidden print:table-cell px-4 py-3.5 w-28 text-left print:w-[12%] print:text-[9px] print:font-bold">Classificação</th>
                  <th className="px-4 py-3.5 print:w-[34%] print:text-[9px] print:font-bold">
                    <span className="print:hidden">Nome da Conta</span>
                    <span className="hidden print:inline">Descrição da conta</span>
                  </th>
                  <th className="px-4 py-3.5 text-right w-44 print:w-[12%] print:text-[9px] print:font-bold">Saldo Anterior</th>
                  <th className="px-4 py-3.5 text-right w-40 print:w-[12%] print:text-[9px] print:font-bold">
                    <span className="print:hidden">Débito Período</span>
                    <span className="hidden print:inline">Débito</span>
                  </th>
                  <th className="px-4 py-3.5 text-right w-40 print:w-[12%] print:text-[9px] print:font-bold">
                    <span className="print:hidden">Crédito Período</span>
                    <span className="hidden print:inline">Crédito</span>
                  </th>
                  <th className="px-4 py-3.5 text-right w-44 print:w-[12%] print:text-[9px] print:font-bold">
                    <span className="print:hidden">Saldo Final</span>
                    <span className="hidden print:inline">Saldo Atual</span>
                  </th>
                  <th className="px-4 py-3.5 text-center w-24 print:hidden">Tipo</th>
                  <th className="px-4 py-3.5 text-center w-24 print:hidden">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white print:divide-none">
                {filteredItems.map((item) => (
                  <TrialBalanceRow key={item.id} item={item} sequenceNumber={item.sequenceNumber} />
                ))}
              </tbody>

              {/* Rodapé Contábil Consolidado (Somente Tela) */}
              <tfoot className="print:hidden">
                <tr className="bg-gray-50 font-bold border-t border-gray-200 text-xs text-gray-800">
                  <td colSpan={2} className="px-4 py-4 text-left">
                    TOTALIZADOR CONTÁBIL (ANALÍTICAS)
                  </td>
                  
                  {/* Saldo Anterior */}
                  <td className="px-4 py-4 text-right font-mono">
                    <div className="flex flex-col gap-0.5 items-end justify-end">
                      <span className="text-[10px] text-gray-400 font-sans font-normal uppercase">Devedor / Credor</span>
                      <div className="space-y-0.5 text-[11px]">
                        <div>D: <span className="text-cyan-700">{formatCurrencyBRL(tableFooterTotals.antDeb)}</span></div>
                        <div>C: <span className="text-amber-700">{formatCurrencyBRL(tableFooterTotals.antCre)}</span></div>
                      </div>
                    </div>
                  </td>

                  {/* Movimentações do Período */}
                  <td className="px-4 py-4 text-right font-mono text-blue-700">
                    {formatCurrencyBRL(tableFooterTotals.perDeb)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-amber-700">
                    {formatCurrencyBRL(tableFooterTotals.perCre)}
                  </td>

                  {/* Saldo Final */}
                  <td className="px-4 py-4 text-right font-mono">
                    <div className="flex flex-col gap-0.5 items-end justify-end">
                      <span className="text-[10px] text-gray-400 font-sans font-normal uppercase">Devedor / Credor</span>
                      <div className="space-y-0.5 text-[11px]">
                        <div>D: <span className="text-cyan-700">{formatCurrencyBRL(tableFooterTotals.finDeb)}</span></div>
                        <div>C: <span className="text-amber-700">{formatCurrencyBRL(tableFooterTotals.finCre)}</span></div>
                      </div>
                      {isFooterBalanced ? (
                        <span className="text-[9px] text-green-600 bg-green-50 px-1 py-0.2 rounded mt-1 font-sans font-bold border border-green-150 uppercase tracking-wider">
                          Equilibrado
                        </span>
                      ) : (
                        <span className="text-[9px] text-red-600 bg-red-50 px-1 py-0.2 rounded mt-1 font-sans font-bold border border-red-150 uppercase tracking-wider animate-pulse">
                          Divergência: {formatCurrencyBRL(footerDiff)}
                        </span>
                      )}
                    </div>
                  </td>

                  <td colSpan={2} className="bg-gray-50" />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center max-w-md mx-auto space-y-3">
            <div className="p-3 bg-gray-50 text-gray-400 rounded-full w-fit mx-auto">
              <Info className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-gray-700">Nenhuma conta encontrada</h4>
            <p className="text-sm text-gray-500">
              A listagem está vazia para os filtros atuais. Desmarque "Ocultar contas zeradas" ou limpe a pesquisa para visualizar os registros.
            </p>
          </div>
        )}
      </div>

      {/* Resumo do Balancete (Exclusivo Impressão) */}
      <div className="hidden print:block mt-8 select-none font-mono text-[10px] text-black">
        <div className="font-bold text-center py-1 uppercase border border-black mb-3 text-xs">
          RESUMO DO BALANCETE
        </div>
        <table className="w-full text-left border-collapse print:table-fixed">
          <thead>
            <tr className="border-b border-black font-bold uppercase">
              <th className="px-2 py-1 print:w-[6%] text-[10px]"></th>
              <th className="hidden print:table-cell px-2 py-1 print:w-[12%] text-left text-[10px]"></th>
              <th className="px-2 py-1 print:w-[34%] text-[10px]">Descrição</th>
              <th className="px-2 py-1 text-right print:w-[12%] text-[10px]">Saldo Anterior</th>
              <th className="px-2 py-1 text-right print:w-[12%] text-[10px]">Débito</th>
              <th className="px-2 py-1 text-right print:w-[12%] text-[10px]">Crédito</th>
              <th className="px-2 py-1 text-right print:w-[12%] text-[10px]">Saldo Atual</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-300 font-bold">
              <td className="px-2 py-1 w-20"></td>
              <td className="hidden print:table-cell px-2 py-1 w-28 text-left"></td>
              <td className="px-2 py-1 uppercase">ATIVO</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.devedoras.ant)}D</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.devedoras.deb)}</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.devedoras.cre)}</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.devedoras.fin)}D</td>
            </tr>
            <tr className="border-b border-gray-300 font-bold">
              <td className="px-2 py-1 w-20"></td>
              <td className="hidden print:table-cell px-2 py-1 w-28 text-left"></td>
              <td className="px-2 py-1 uppercase">PASSIVO</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.credoras.ant)}C</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.credoras.deb)}</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.credoras.cre)}</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.credoras.fin)}C</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="px-2 py-1 w-20"></td>
              <td className="hidden print:table-cell px-2 py-1 w-28 text-left"></td>
              <td className="px-2 py-1">CONTAS DE RESULTADOS - CUSTOS E DESPESAS</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="px-2 py-1 w-20"></td>
              <td className="hidden print:table-cell px-2 py-1 w-28 text-left"></td>
              <td className="px-2 py-1">CONTAS DE RESULTADO - RECEITAS</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
            </tr>
            <tr className="border-b border-gray-300">
              <td className="px-2 py-1 w-20"></td>
              <td className="hidden print:table-cell px-2 py-1 w-28 text-left"></td>
              <td className="px-2 py-1">CONTAS DE APURAÇÃO</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
            </tr>
            
            <tr className="border-b border-gray-300 font-bold">
              <td className="px-2 py-1 w-20"></td>
              <td className="hidden print:table-cell px-2 py-1 w-28 text-left"></td>
              <td className="px-2 py-1">CONTAS DEVEDORAS</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.devedoras.ant)}D</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.devedoras.deb)}</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.devedoras.cre)}</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.devedoras.fin)}D</td>
            </tr>
            <tr className="border-b border-black font-bold">
              <td className="px-2 py-1 w-20"></td>
              <td className="hidden print:table-cell px-2 py-1 w-28 text-left"></td>
              <td className="px-2 py-1">CONTAS CREDORAS</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.credoras.ant)}C</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.credoras.deb)}</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.credoras.cre)}</td>
              <td className="px-2 py-1 text-right">{formatNumberBRL(resumoTotals.credoras.fin)}C</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="px-2 py-1 w-20"></td>
              <td className="hidden print:table-cell px-2 py-1 w-28 text-left"></td>
              <td className="px-2 py-1">RESULTADO DO MES</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
            </tr>
            <tr className="border-b border-black">
              <td className="px-2 py-1 w-20"></td>
              <td className="hidden print:table-cell px-2 py-1 w-28 text-left"></td>
              <td className="px-2 py-1">RESULTADO DO EXERCÍCIO</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
              <td className="px-2 py-1 text-right">0,00</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
