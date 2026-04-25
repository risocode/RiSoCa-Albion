import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type MarketRegion = 'all' | 'asia' | 'europe' | 'americas'

export type MarketPriceRow = {
  id: string
  city: string
  price: number
  postedAt: string
  source: string | null
  itemId: string
  itemUniqueName: string
  itemName: string
  tier: number
  enchantment: number
}

export type MarketSort = 'updated_desc' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc'

export type MarketQueryParams = {
  city?: string
  tier?: number
  enchantment?: number
  region?: MarketRegion
  search?: string
  sort?: MarketSort
  limit?: number
}

type SupabaseItemCatalog = {
  item_unique_name: string
  item_name: string
  tier: number
  enchantment: number
}

type SupabaseItemPrice = {
  id: string
  city: string
  price: number
  posted_at: string
  source: string | null
  item_id: string
  item_catalog: SupabaseItemCatalog | SupabaseItemCatalog[] | null
}

let supabaseClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient
  const url =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
    (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined)
  const anonKey =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
    (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined)
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase config: set VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }
  supabaseClient = createClient(url, anonKey)
  return supabaseClient
}

function normalizeItemCatalog(
  value: SupabaseItemCatalog | SupabaseItemCatalog[] | null
): SupabaseItemCatalog | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function normalizeRows(rows: SupabaseItemPrice[]): MarketPriceRow[] {
  const out: MarketPriceRow[] = []
  for (const row of rows) {
    const item = normalizeItemCatalog(row.item_catalog)
    if (!item) continue
    out.push({
      id: row.id,
      city: row.city,
      price: Number(row.price ?? 0),
      postedAt: row.posted_at,
      source: row.source,
      itemId: row.item_id,
      itemUniqueName: item.item_unique_name,
      itemName: item.item_name,
      tier: Number(item.tier ?? 0),
      enchantment: Number(item.enchantment ?? 0),
    })
  }
  return out
}

function applyClientSort(rows: MarketPriceRow[], sort: MarketSort): MarketPriceRow[] {
  const next = [...rows]
  if (sort === 'updated_desc') {
    return next.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
  }
  if (sort === 'price_asc') return next.sort((a, b) => a.price - b.price)
  if (sort === 'price_desc') return next.sort((a, b) => b.price - a.price)
  if (sort === 'name_desc') return next.sort((a, b) => b.itemName.localeCompare(a.itemName))
  return next.sort((a, b) => a.itemName.localeCompare(b.itemName))
}

export async function fetchMarketPrices(params: MarketQueryParams): Promise<{
  rows: MarketPriceRow[]
  hasRegionMetadata: boolean
}> {
  const client = getSupabaseClient()
  const limit = Math.max(50, Math.min(params.limit ?? 2000, 10000))
  const batchSize = 500
  const sort = params.sort ?? 'updated_desc'
  const outRows: SupabaseItemPrice[] = []
  let offset = 0
  while (outRows.length < limit) {
    const fetchSize = Math.min(batchSize, limit - outRows.length)
    let query = client
      .from('item_prices')
      .select(
        'id, city, price, posted_at, source, item_id, item_catalog!item_prices_item_id_fkey(item_unique_name, item_name, tier, enchantment)'
      )
      .range(offset, offset + fetchSize - 1)

    if (params.city && params.city !== 'all') query = query.eq('city', params.city)
    if (typeof params.tier === 'number') {
      query = query.eq('item_catalog.tier', params.tier)
    }
    if (typeof params.enchantment === 'number') {
      query = query.eq('item_catalog.enchantment', params.enchantment)
    }
    if (params.search && params.search.trim()) {
      const q = params.search.trim()
      query = query.or(`item_catalog.item_name.ilike.%${q}%,item_catalog.item_unique_name.ilike.%${q}%`)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as SupabaseItemPrice[]
    if (batch.length === 0) break
    outRows.push(...batch)
    if (batch.length < fetchSize) break
    offset += fetchSize
  }

  let rows = normalizeRows(outRows)
  const hasRegionMetadata = rows.some((r) => typeof r.source === 'string' && r.source.trim().length > 0)
  if (params.region && params.region !== 'all') {
    rows = rows.filter((row) => (row.source ?? '').toLowerCase().includes(params.region!))
  }
  rows = applyClientSort(rows, sort)
  return { rows, hasRegionMetadata }
}
