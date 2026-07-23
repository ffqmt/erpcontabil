import { TaxType, TaxAssessmentLineType, TaxAssessmentLineSourceType } from '../types'

export interface TaxLineClassificationInput {
  taxType: TaxType | string
  documentDirection: 'IN' | 'OUT'
  sourceType: TaxAssessmentLineSourceType
  amount: number
  documentNumber?: string | number | null
  fiscalDocumentId: string
  sourceId: string
  baseAmount?: number | string | null
  taxRate?: number | string | null
  withheldByPartner?: boolean | null
}

export interface TaxLineClassificationResult {
  shouldInclude: boolean
  lineType: TaxAssessmentLineType
  sourceType: TaxAssessmentLineSourceType
  description: string
  amount: number
  baseAmount?: number | string | null
  taxRate?: number | string | null
  effect: 'DEBIT' | 'CREDIT' | 'RETENTION' | 'IGNORE'
  explanation: string
}

/**
 * Camada central de classificação de linhas de apuração fiscal (Etapa 35B.2).
 * 
 * Regras da camada inicial:
 * Documentos de Entrada (direction = IN - compra/serviço tomado):
 * - ICMS/IPI recuperáveis: CREDIT (crédito de entrada).
 * - IRRF/INSS_RETIDO/PCC/ISS retidos de fornecedor/prestador: DEBIT (obrigação a recolher pela tomadora).
 * - Tributos não recuperáveis: ignorar na geração automática de crédito.
 * 
 * Documentos de Saída (direction = OUT - venda/serviço prestado):
 * - ICMS/IPI/ISS/SIMPLES próprios: DEBIT (débito a recolher da empresa).
 * - IRRF/INSS_RETIDO/PCC/ISS retidos pelo cliente/tomador: RETENTION (retenção sofrida / crédito a compensar).
 */
export function classifyTaxAssessmentLine(input: TaxLineClassificationInput): TaxLineClassificationResult {
  const normTaxType = (input.taxType || '').toUpperCase() as TaxType
  const docNumberStr = input.documentNumber ? `documento ${input.documentNumber}` : `documento ${input.fiscalDocumentId}`
  const amount = Number(input.amount) || 0

  if (amount <= 0) {
    return {
      shouldInclude: false,
      lineType: 'DEBIT',
      sourceType: input.sourceType,
      description: '',
      amount: 0,
      effect: 'IGNORE',
      explanation: 'Valor menor ou igual a zero.'
    }
  }

  // 1. Linhas de Retenção na fonte (tabela fiscal_document_retentions ou tributos retidos)
  if (input.sourceType === 'RETENTION' || ['IRRF', 'INSS_RETIDO', 'PCC'].includes(normTaxType)) {
    if (input.documentDirection === 'IN') {
      // Tomada de serviço/compra: retenção efetuada do fornecedor => Obrigação a recolher (DEBIT)
      return {
        shouldInclude: true,
        lineType: 'DEBIT',
        sourceType: 'RETENTION',
        description: `${normTaxType} retido de fornecedor — ${docNumberStr}`,
        amount,
        baseAmount: input.baseAmount,
        taxRate: input.taxRate,
        effect: 'DEBIT',
        explanation: 'Retenção efetuada em documento de entrada (serviço tomado): tributo a recolher pela empresa tomadora ao fisco.'
      }
    } else {
      // Prestação de serviço/venda: retenção sofrida do cliente => Crédito / Dedução (RETENTION)
      return {
        shouldInclude: true,
        lineType: 'RETENTION',
        sourceType: 'RETENTION',
        description: `${normTaxType} retido na fonte por cliente — ${docNumberStr}`,
        amount,
        baseAmount: input.baseAmount,
        taxRate: input.taxRate,
        effect: 'RETENTION',
        explanation: 'Retenção sofrida em documento de saída (serviço prestado): direito a compensação/dedução do tributo devido.'
      }
    }
  }

  // 2. Operações próprias em cabeçalho ou itens de documento fiscal
  if (input.documentDirection === 'OUT') {
    // Saída: tributos próprios sobre faturamento (ICMS, IPI, ISS, SIMPLES) => Débito
    return {
      shouldInclude: true,
      lineType: 'DEBIT',
      sourceType: input.sourceType,
      description: `${normTaxType} — ${docNumberStr}`,
      amount,
      baseAmount: input.baseAmount,
      taxRate: input.taxRate,
      effect: 'DEBIT',
      explanation: 'Tributo próprio apurado sobre documento fiscal de saída.'
    }
  }

  if (input.documentDirection === 'IN') {
    // Entrada: ICMS e IPI são recuperáveis por padrão => Crédito
    if (['ICMS', 'IPI'].includes(normTaxType)) {
      return {
        shouldInclude: true,
        lineType: 'CREDIT',
        sourceType: input.sourceType,
        description: `Crédito de ${normTaxType} — ${docNumberStr}`,
        amount,
        baseAmount: input.baseAmount,
        taxRate: input.taxRate,
        effect: 'CREDIT',
        explanation: 'Crédito tributário apurado sobre documento fiscal de entrada.'
      }
    }

    return {
      shouldInclude: false,
      lineType: 'CREDIT',
      sourceType: input.sourceType,
      description: `Operação de entrada ${normTaxType} sem crédito automático — ${docNumberStr}`,
      amount,
      baseAmount: input.baseAmount,
      taxRate: input.taxRate,
      effect: 'IGNORE',
      explanation: 'Tributo de entrada não recuperável automaticamente na apuração.'
    }
  }

  return {
    shouldInclude: false,
    lineType: 'DEBIT',
    sourceType: input.sourceType,
    description: '',
    amount,
    effect: 'IGNORE',
    explanation: 'Direção do documento fiscal não identificada.'
  }
}
