'use client'

import React, { useState, useMemo } from 'react'
import { ChartAccount } from '../types'
import { AccountFilters, FilterState } from './account-filters'
import { AccountRow } from './account-row'
import { ChartAccountForm } from './chart-account-form'
import {
  FolderTree,
  Layers,
  FileCheck2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Plus
} from 'lucide-react'

interface AccountsTableProps {
  accounts: ChartAccount[]
}

export function AccountsTable({ accounts }: AccountsTableProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    type: '',
    balance: '',
    isSynthetic: '',
    status: ''
  })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null)

  // Calcula resumos baseados em TODOS os registros carregados da empresa
  const stats = useMemo(() => {
    return {
      total: accounts.length,
      synthetic: accounts.filter(a => a.is_synthetic).length,
      analytic: accounts.filter(a => !a.is_synthetic).length,
      active: accounts.filter(a => a.is_active).length,
      inactive: accounts.filter(a => !a.is_active).length
    }
  }, [accounts])

  // Filtra as contas contábeis dinamicamente no lado do cliente
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // 1. Filtro de Busca (Código ou Nome)
      if (filters.search) {
        const term = filters.search.toLowerCase()
        const matchCode = acc.code.toLowerCase().includes(term)
        const matchName = acc.name.toLowerCase().includes(term)
        if (!matchCode && !matchName) return false
      }

      // 2. Filtro de Tipo da Conta
      if (filters.type && acc.account_type !== filters.type) {
        return false
      }

      // 3. Filtro de Natureza (Débito/Crédito)
      if (filters.balance && acc.normal_balance !== filters.balance) {
        return false
      }

      // 4. Filtro de Estrutura (Sintética/Analítica)
      if (filters.isSynthetic !== '') {
        const filterVal = filters.isSynthetic === 'true'
        if (acc.is_synthetic !== filterVal) return false
      }

      // 5. Filtro de Status (Ativa/Inativa)
      if (filters.status !== '') {
        const filterVal = filters.status === 'true'
        if (acc.is_active !== filterVal) return false
      }

      return true
    })
  }, [accounts, filters])

  return (
    <div className="space-y-6">
      {/* Ação: Nova Conta */}
      <div className="flex justify-end">
        {!showCreateForm && !editingAccount && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Conta
          </button>
        )}
      </div>

      {showCreateForm && (
        <ChartAccountForm accounts={accounts} onClose={() => setShowCreateForm(false)} onSuccess={() => setShowCreateForm(false)} />
      )}
      {editingAccount && (
        <ChartAccountForm account={editingAccount} accounts={accounts} onClose={() => setEditingAccount(null)} onSuccess={() => setEditingAccount(null)} />
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total de Contas */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total de Contas</span>
            <div className="text-lg font-bold text-gray-800">{stats.total}</div>
          </div>
        </div>

        {/* Contas Sintéticas */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sintéticas</span>
            <div className="text-lg font-bold text-gray-800">{stats.synthetic}</div>
          </div>
        </div>

        {/* Contas Analíticas */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Analíticas</span>
            <div className="text-lg font-bold text-gray-800">{stats.analytic}</div>
          </div>
        </div>

        {/* Contas Ativas */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-green-50 text-green-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Ativas</span>
            <div className="text-lg font-bold text-gray-800">{stats.active}</div>
          </div>
        </div>

        {/* Contas Inativas */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="p-2 bg-gray-50 text-gray-400 rounded-lg">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Inativas</span>
            <div className="text-lg font-bold text-gray-800">{stats.inactive}</div>
          </div>
        </div>
      </div>

      {/* Seção de Filtros */}
      <AccountFilters onFilterChange={setFilters} />

      {/* Tabela de Contas */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {filteredAccounts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3.5 w-32">Código</th>
                  <th className="px-4 py-3.5">Nome da Conta</th>
                  <th className="px-4 py-3.5 w-20 text-center">Nível</th>
                  <th className="px-4 py-3.5 w-32 text-center">Tipo</th>
                  <th className="px-4 py-3.5 w-36 text-center">Natureza</th>
                  <th className="px-4 py-3.5 w-28 text-center">Estrutura</th>
                  <th className="px-4 py-3.5 w-36 text-center">Lançamentos</th>
                  <th className="px-4 py-3.5 w-24 text-center">Status</th>
                  <th className="px-4 py-3.5 w-20 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredAccounts.map((account) => (
                  <AccountRow key={account.id} account={account} onEdit={setEditingAccount} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center max-w-md mx-auto space-y-3">
            <div className="p-3 bg-gray-50 text-gray-400 rounded-full w-fit mx-auto">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-gray-700">Nenhuma conta encontrada</h4>
            <p className="text-sm text-gray-500">
              A busca não retornou contas para os filtros ativos. Remova ou altere as seleções de pesquisa para ver os resultados.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
