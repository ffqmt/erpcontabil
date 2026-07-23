import {
  FiscalOperationKind,
  FiscalPurpose,
  IcmsTreatment,
  IcmsStTreatment,
  IpiTreatment,
  PisCofinsTreatment,
  IssTreatment,
  ExpectedRetentionType,
  ItemNatureDefault,
  FiscalDocumentTypeCode
} from './types'

export const OPERATION_KIND_LABELS: Record<FiscalOperationKind, string> = {
  PURCHASE_MERCHANDISE: 'Compra para Revenda',
  PURCHASE_INPUT: 'Compra de Insumo',
  PURCHASE_FIXED_ASSET: 'Compra de Ativo Imobilizado',
  PURCHASE_USE_CONSUMPTION: 'Compra para Uso/Consumo',
  SALE_MERCHANDISE: 'Venda de Mercadoria',
  SERVICE_PROVIDED: 'Serviço Prestado',
  SERVICE_TAKEN: 'Serviço Tomado',
  RETURN_PURCHASE: 'Devolução de Compra',
  RETURN_SALE: 'Devolução de Venda',
  TRANSFER: 'Transferência entre Estabelecimentos',
  OTHER: 'Outro'
}

export const FISCAL_PURPOSE_LABELS: Record<FiscalPurpose, string> = {
  RESALE: 'Revenda',
  INPUT: 'Insumo de Produção',
  FIXED_ASSET: 'Ativo Imobilizado',
  USE_CONSUMPTION: 'Uso/Consumo',
  SERVICE: 'Serviço',
  OTHER: 'Outro'
}

export const ICMS_TREATMENT_LABELS: Record<IcmsTreatment, string> = {
  TAXED: 'Tributado Integral',
  TAXED_REDUCED_BASE: 'Tributado com Redução de Base',
  EXEMPT: 'Isento',
  NOT_TAXED: 'Não Tributado',
  SUSPENDED: 'Suspenso',
  DEFERRED: 'Diferido'
}

export const ICMS_ST_TREATMENT_LABELS: Record<IcmsStTreatment, string> = {
  NONE: 'Sem ICMS-ST',
  RETAINED_BY_ISSUER: 'ICMS-ST retido pelo emitente',
  COMPANY_CALCULATES: 'Empresa calcula o ICMS-ST'
}

export const IPI_TREATMENT_LABELS: Record<IpiTreatment, string> = {
  TAXED: 'Tributado',
  EXEMPT: 'Isento',
  NOT_TAXED: 'Não Tributado',
  SUSPENDED: 'Suspenso'
}

export const PIS_COFINS_TREATMENT_LABELS: Record<PisCofinsTreatment, string> = {
  TAXED: 'Tributado (regime normal)',
  TAXED_WITH_CREDIT: 'Tributado com Crédito (Lucro Real)',
  MONOPHASE: 'Monofásico',
  SUBSTITUTION: 'Substituição Tributária',
  EXEMPT: 'Isento'
}

export const ISS_TREATMENT_LABELS: Record<IssTreatment, string> = {
  TAXED_AT_PROVIDER_CITY: 'Tributado no Município do Prestador',
  TAXED_AT_TAKER_CITY: 'Tributado no Município do Tomador',
  EXEMPT: 'Isento',
  IMMUNE: 'Imune',
  WITH_RETENTION: 'Com Retenção'
}

export const EXPECTED_RETENTION_LABELS: Record<ExpectedRetentionType, string> = {
  ISS: 'ISS Retido',
  INSS_RETIDO: 'INSS Retido',
  IRRF: 'IRRF',
  PIS: 'PIS Retido',
  COFINS: 'COFINS Retido',
  PCC: 'CSLL/PCC Retido'
}

export const ITEM_NATURE_DEFAULT_LABELS: Record<ItemNatureDefault, string> = {
  PRODUCT: 'Produto',
  SERVICE: 'Serviço',
  FREIGHT: 'Frete',
  ASSET: 'Ativo Imobilizado',
  OTHER: 'Outro'
}

export const FISCAL_DOCUMENT_TYPE_CODE_LABELS: Record<FiscalDocumentTypeCode, string> = {
  NFE: 'NF-e',
  NFCE: 'NFC-e',
  NFSE: 'NFS-e',
  CTE: 'CT-e',
  CTE_OS: 'CT-e OS',
  MDFE: 'MDF-e',
  MANUAL: 'Documento Manual',
  OTHER: 'Outro'
}

export const DEFAULT_FISCAL_NATURE_SEED: Array<{ code: string; name: string; direction: 'INBOUND' | 'OUTBOUND' | 'BOTH'; operationKind: FiscalOperationKind }> = [
  { code: 'COMPRA-REVENDA', name: 'Compra para Revenda', direction: 'INBOUND', operationKind: 'PURCHASE_MERCHANDISE' },
  { code: 'COMPRA-INSUMO', name: 'Compra de Insumo', direction: 'INBOUND', operationKind: 'PURCHASE_INPUT' },
  { code: 'COMPRA-ATIVO', name: 'Compra de Ativo Imobilizado', direction: 'INBOUND', operationKind: 'PURCHASE_FIXED_ASSET' },
  { code: 'COMPRA-USO-CONSUMO', name: 'Compra para Uso/Consumo', direction: 'INBOUND', operationKind: 'PURCHASE_USE_CONSUMPTION' },
  { code: 'VENDA-MERCADORIA', name: 'Venda de Mercadoria', direction: 'OUTBOUND', operationKind: 'SALE_MERCHANDISE' },
  { code: 'SERVICO-PRESTADO', name: 'Serviço Prestado', direction: 'OUTBOUND', operationKind: 'SERVICE_PROVIDED' },
  { code: 'SERVICO-TOMADO', name: 'Serviço Tomado', direction: 'INBOUND', operationKind: 'SERVICE_TAKEN' },
  { code: 'DEVOLUCAO-COMPRA', name: 'Devolução de Compra', direction: 'OUTBOUND', operationKind: 'RETURN_PURCHASE' },
  { code: 'DEVOLUCAO-VENDA', name: 'Devolução de Venda', direction: 'INBOUND', operationKind: 'RETURN_SALE' },
  { code: 'TRANSFERENCIA', name: 'Transferência entre Estabelecimentos', direction: 'BOTH', operationKind: 'TRANSFER' }
]
