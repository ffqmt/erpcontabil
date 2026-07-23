import { getClient } from '@/lib/supabase/server'
import { AssetCategory, FixedAsset, AssetDepreciation, AssetsDashboardData } from './types'

async function getDb() {
  return getClient()
}

export async function listAssetCategories(companyId: string): Promise<AssetCategory[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')
  const db = await getDb()
  const { data, error } = await db.from('asset_categories').select('*').eq('company_id', companyId).order('name', { ascending: true })
  if (error) throw new Error(error.message || 'Falha ao buscar categorias patrimoniais.')
  return (data || []) as AssetCategory[]
}

async function attachAccumulatedDepreciation(db: any, companyId: string, assets: any[]): Promise<FixedAsset[]> {
  if (assets.length === 0) return []

  const ids = assets.map((a) => a.id)
  const { data: deps } = await db
    .from('asset_depreciations')
    .select('fixed_asset_id, accounting_amount')
    .eq('company_id', companyId)
    .in('fixed_asset_id', ids)
    .neq('status', 'CANCELLED')

  const accumulatedByAsset = new Map<string, number>()
  ;(deps || []).forEach((d: any) => {
    const amt = typeof d.accounting_amount === 'string' ? parseFloat(d.accounting_amount) : d.accounting_amount
    accumulatedByAsset.set(d.fixed_asset_id, (accumulatedByAsset.get(d.fixed_asset_id) || 0) + (amt || 0))
  })

  return assets.map((a) => {
    const acquisition = typeof a.acquisition_amount === 'string' ? parseFloat(a.acquisition_amount) : a.acquisition_amount
    const accumulated = accumulatedByAsset.get(a.id) || 0
    return { ...a, accumulated_depreciation: accumulated, net_book_value: acquisition - accumulated }
  })
}

export async function listFixedAssets(companyId: string, filters: { status?: string; categoryId?: string } = {}): Promise<FixedAsset[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')
  const db = await getDb()

  let query = db.from('fixed_assets').select('*, category:asset_categories(name)').eq('company_id', companyId)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)

  const { data, error } = await query.order('acquisition_date', { ascending: false })
  if (error) throw new Error(error.message || 'Falha ao buscar bens patrimoniais.')

  return attachAccumulatedDepreciation(db, companyId, data || [])
}

export async function getFixedAssetById(id: string, companyId: string): Promise<FixedAsset | null> {
  if (!id || !companyId) throw new Error('ID de bem e empresa ativa são obrigatórios.')
  const db = await getDb()

  const { data, error } = await db.from('fixed_assets').select('*, category:asset_categories(*)').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (error) throw new Error(error.message || 'Falha ao buscar o bem patrimonial.')
  if (!data) return null

  const [withDepreciation] = await attachAccumulatedDepreciation(db, companyId, [data])
  return withDepreciation
}

export async function listAssetDepreciations(companyId: string, filters: { status?: string; competence?: string } = {}): Promise<AssetDepreciation[]> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')
  const db = await getDb()

  let query = db.from('asset_depreciations').select('*, fixed_asset:fixed_assets(code, description)').eq('company_id', companyId)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.competence) query = query.eq('competence', `${filters.competence.substring(0, 7)}-01`)

  const { data, error } = await query.order('competence', { ascending: false })
  if (error) throw new Error(error.message || 'Falha ao buscar depreciações.')

  return (data || []) as unknown as AssetDepreciation[]
}

export async function getAssetsDashboard(companyId: string): Promise<AssetsDashboardData> {
  if (!companyId) throw new Error('Nenhuma empresa ativa fornecida.')
  const db = await getDb()

  const { data: assets, error } = await db.from('fixed_assets').select('id, status, acquisition_amount').eq('company_id', companyId)
  if (error) throw new Error(error.message || 'Falha ao buscar bens patrimoniais.')

  const rows = assets || []
  let activeCount = 0
  let fullyDepreciatedCount = 0
  let disposedCount = 0
  let totalAcquisitionValue = 0

  rows.forEach((a: any) => {
    const amt = typeof a.acquisition_amount === 'string' ? parseFloat(a.acquisition_amount) : a.acquisition_amount
    if (a.status === 'ACTIVE') activeCount++
    if (a.status === 'FULLY_DEPRECIATED') fullyDepreciatedCount++
    if (a.status === 'DISPOSED' || a.status === 'SOLD') disposedCount++
    if (a.status !== 'DISPOSED' && a.status !== 'SOLD') totalAcquisitionValue += amt || 0
  })

  const nonDisposedRows = rows.filter((a: any) => a.status !== 'DISPOSED' && a.status !== 'SOLD')
  const withDepreciation = await attachAccumulatedDepreciation(db, companyId, nonDisposedRows)
  const totalNetBookValue = withDepreciation.reduce((sum, a) => sum + (a.net_book_value || 0), 0)

  const { count: pendingDepreciationsCount } = await db.from('asset_depreciations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'CALCULATED')

  return {
    activeCount,
    fullyDepreciatedCount,
    disposedCount,
    totalAcquisitionValue,
    totalNetBookValue,
    pendingDepreciationsCount: pendingDepreciationsCount || 0
  }
}
