import type { AodpPriceRow, AodpRegion } from './types'

const REGION_PREFIX: Record<AodpRegion, string> = {
  americas: '/aodp-americas',
  europe: '/aodp-europe',
  asia: '/aodp-asia',
}

const LOCAL_PRICE_FILE: Record<AodpRegion, string> = {
  americas: '/data/prices/americas.json',
  europe: '/data/prices/europe.json',
  asia: '/data/prices/asia.json',
}

export type PriceCity =
  | 'lowest'
  | 'Bridgewatch'
  | 'Martlock'
  | 'Thetford'
  | 'Fort Sterling'
  | 'Lymhurst'
  | 'Caerleon'
  | 'Brecilien'
  | 'Black Market'

/** Cheapest listed sell order (quality 1), optionally scoped to one city. */
function pickSellQ1(rows: AodpPriceRow[], city: PriceCity): number {
  const q1 = rows.filter((r) => r.quality === 1 && r.sell_price_min > 0)
  const pool = city === 'lowest' ? q1 : q1.filter((r) => r.city === city)
  if (pool.length === 0) return 0
  return Math.min(...pool.map((r) => r.sell_price_min))
}

async function loadLocalPriceMap(
  region: AodpRegion,
  city: PriceCity,
  signal?: AbortSignal
): Promise<Record<string, number>> {
  const res = await fetch(LOCAL_PRICE_FILE[region], { signal })
  if (!res.ok) {
    throw new Error(`local price file ${res.status}`)
  }

  const raw = (await res.json()) as unknown
  const out: Record<string, number> = {}

  // Support object map format: { "T4_PLANKS": 123, ... }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    // Object maps only represent one precomputed value per item (lowest price).
    if (city !== 'lowest') return out
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(value)
      if (Number.isFinite(n) && n >= 0) out[id] = n
    }
    return out
  }

  // Support AODP-like row array format.
  if (!Array.isArray(raw)) return out
  const rows = raw as AodpPriceRow[]
  const byItem = new Map<string, AodpPriceRow[]>()
  for (const row of rows) {
    if (!row?.item_id) continue
    if (!byItem.has(row.item_id)) byItem.set(row.item_id, [])
    byItem.get(row.item_id)!.push(row)
  }
  for (const [id, itemRows] of byItem.entries()) {
    out[id] = pickSellQ1(itemRows, city)
  }
  return out
}

export async function fetchPricesForItems(
  region: AodpRegion,
  itemIds: string[],
  city: PriceCity = 'lowest',
  signal?: AbortSignal
): Promise<Record<string, number>> {
  const unique = [...new Set(itemIds)].filter(Boolean)
  const out: Record<string, number> = {}
  if (unique.length === 0) return out

  // Local-first pricing from public/data/prices/<region>.json.
  // Only missing IDs fall back to live API.
  let pending = unique
  try {
    const local = await loadLocalPriceMap(region, city, signal)
    for (const id of unique) {
      if (Object.prototype.hasOwnProperty.call(local, id)) {
        out[id] = local[id]
      }
    }
    pending = unique.filter((id) => !Object.prototype.hasOwnProperty.call(out, id))
    if (pending.length === 0) return out
  } catch {
    // Missing/invalid local file: use API fallback for all IDs.
    pending = unique
  }

  const base = REGION_PREFIX[region]
  const chunkSize = 40
  for (let i = 0; i < pending.length; i += chunkSize) {
    const chunk = pending.slice(i, i + chunkSize)
    const path = `${base}/api/v2/stats/prices/${encodeURIComponent(chunk.join(','))}.json`
    const res = await fetch(path, { signal })
    if (!res.ok) {
      throw new Error(`AODP ${res.status}: ${path}`)
    }
    const data = (await res.json()) as AodpPriceRow[]
    if (!Array.isArray(data)) continue

    const byItem = new Map<string, AodpPriceRow[]>()
    for (const row of data) {
      const id = row.item_id
      if (!byItem.has(id)) byItem.set(id, [])
      byItem.get(id)!.push(row)
    }
    for (const id of chunk) {
      const rows = byItem.get(id) ?? []
      out[id] = pickSellQ1(rows, city)
    }
  }

  return out
}
