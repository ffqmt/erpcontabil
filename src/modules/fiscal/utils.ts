import { FiscalDocumentStatus, FiscalDocumentAccountingStatus, FiscalDocumentTaxStatus, FiscalDocumentType, FiscalOperationType } from './types'

export function formatCurrencyBRL(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (num === null || num === undefined || isNaN(num)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr + 'T00:00:00')
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export const FISCAL_DOCUMENT_STATUS_LABELS: Record<FiscalDocumentStatus, string> = {
  DRAFT: 'Rascunho',
  IMPORTED: 'Importado',
  VALIDATED: 'Validado',
  BOOKED: 'Escriturado',
  CANCELLED: 'Cancelado'
}

export const FISCAL_DOCUMENT_ACCOUNTING_STATUS_LABELS: Record<FiscalDocumentAccountingStatus, string> = {
  NOT_ACCOUNTED: 'Não Contabilizado',
  ACCOUNTED: 'Contabilizado',
  ACCOUNTING_ERROR: 'Erro na Contabilização'
}

export const FISCAL_DOCUMENT_TAX_STATUS_LABELS: Record<FiscalDocumentTaxStatus, string> = {
  NOT_ASSESSED: 'Não Apurado',
  ASSESSED: 'Apurado',
  IGNORED: 'Ignorado'
}

export const FISCAL_DOCUMENT_TYPE_LABELS: Record<FiscalDocumentType, string> = {
  NFE: 'NF-e',
  NFCE: 'NFC-e',
  NFSE: 'NFS-e',
  CTE: 'CT-e',
  CTE_OS: 'CT-e OS',
  MDFE: 'MDF-e',
  MANUAL: 'Documento Manual',
  OTHER: 'Outro'
}

export const FISCAL_OPERATION_TYPE_LABELS: Record<FiscalOperationType, string> = {
  PURCHASE: 'Compra',
  SALE: 'Venda',
  SERVICE_TAKEN: 'Serviço Tomado',
  SERVICE_PROVIDED: 'Serviço Prestado',
  FREIGHT: 'Frete',
  RETURN: 'Devolução',
  TRANSFER: 'Transferência',
  OTHER: 'Outro'
}

export const EDITABLE_FISCAL_STATUSES = ['DRAFT', 'IMPORTED', 'VALIDATED'] as const
