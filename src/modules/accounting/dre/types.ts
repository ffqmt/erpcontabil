import { AccountType } from '../accounts/types'

export interface DreItem {
  id: string
  code: string
  name: string
  parent_id: string | null
  account_type: AccountType
  level: number
  is_synthetic: boolean
  
  // Valores calculados
  debits: number
  credits: number
  signedAmount: number // Débito - Crédito
  displayAmount: number // Valor formatado com o sinal correto de DRE
}

export interface DreSectionData {
  title: string
  type: 'REVENUE' | 'REVENUE_DEDUCTION' | 'COST' | 'EXPENSE' | 'IRPJ_CSLL'
  items: DreItem[]
  total: number
}

export interface DreReportData {
  competence: string
  sections: {
    revenue: DreSectionData          // (+) Receita Bruta
    deductions: DreSectionData       // (-) Deduções da Receita
    costs: DreSectionData            // (-) Custos
    expenses: DreSectionData         // (-) Despesas Operacionais
    tax: DreSectionData              // (-) IRPJ/CSLL (código iniciando em 8)
  }
  // Subtotais Contábeis
  grossRevenue: number              // Receita Bruta
  deductionsTotal: number           // Deduções da Receita
  netRevenue: number                // Receita Líquida
  costsTotal: number                // Custos
  grossProfit: number               // Lucro Bruto
  expensesTotal: number             // Despesas Operacionais
  operatingProfit: number           // Resultado Operacional
  taxTotal: number                  // Provisão de Impostos
  netProfit: number                 // Lucro Líquido do Período
  netMargin: number                 // Margem Líquida %
}
