export type ItemType = 'PRODUCT' | 'SERVICE' | 'BOTH'
export type FiscalItemUsage = 'RESALE' | 'INPUT' | 'FIXED_ASSET' | 'USE_CONSUMPTION' | 'SERVICE' | 'OTHER'

export const FISCAL_ITEM_USAGE_LABELS: Record<FiscalItemUsage, string> = {
  RESALE: 'Revenda',
  INPUT: 'Insumo',
  FIXED_ASSET: 'Ativo Imobilizado',
  USE_CONSUMPTION: 'Uso e Consumo',
  SERVICE: 'Serviço',
  OTHER: 'Outro'
}

export interface Item {
  id: string
  workspace_id: string
  company_id: string
  code: string
  name: string
  description: string | null
  item_type: ItemType
  unit: string | null
  ncm: string | null
  service_code: string | null
  cest: string | null
  gtin: string | null
  default_fiscal_operation_nature_id: string | null
  fiscal_item_usage: FiscalItemUsage | null
  active: boolean
  created_at: string
  updated_at: string
}
