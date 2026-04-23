import { useEffect, useMemo, useRef, useState } from 'react'
import {
  itemMatchesSearchQuery,
  summarizeItemHoverLabel,
  type ItemNameMap,
} from './formatItemName'
import { ItemIcon } from './ItemIcon'
import type { AodpPriceRow, AodpRegion, CraftRecipe } from './types'
import {
  failBlackMarketFetch,
  finishBlackMarketFetch,
  setBlackMarketFetchPhase,
  startBlackMarketFetch,
} from './blackMarketFetchState'

type CombatCategory = 'weapons' | 'offhands' | 'head' | 'chest' | 'boots'

type CategoryConfig = {
  id: CombatCategory
  label: string
  recipeUrl: string
}

type RecipePayload = { recipes?: CraftRecipe[] }

type FlipCandidate = {
  uniqueName: string
  baseUniqueName: string
  category: CombatCategory
  tier: number | null
}

type FlipRow = FlipCandidate & {
  caerleonBuy: number
  blackMarketSell: number
  grossSpread: number
  netSell: number
  profit: number
  marginPct: number
}

const CATEGORY_CONFIG: CategoryConfig[] = [
  { id: 'weapons', label: 'Weapons', recipeUrl: '/data/weapons_recipes.json' },
  { id: 'offhands', label: 'Off-hands', recipeUrl: '/data/offhands_recipes.json' },
  { id: 'head', label: 'Head', recipeUrl: '/data/head_recipes.json' },
  { id: 'chest', label: 'Chest', recipeUrl: '/data/chest_recipes.json' },
  { id: 'boots', label: 'Boots', recipeUrl: '/data/boots_recipes.json' },
]

const REGION_OPTIONS: Array<{ value: AodpRegion; label: string }> = [
  { value: 'asia', label: 'Asia' },
  { value: 'europe', label: 'Europe' },
  { value: 'americas', label: 'Americas' },
]
const REGION_PREFIX: Record<AodpRegion, string> = {
  americas: '/aodp-americas',
  europe: '/aodp-europe',
  asia: '/aodp-asia',
}

function tierFromUniqueName(uniqueName: string): number | null {
  const m = uniqueName.match(/^T(\d+)_/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function parseEnchantFromId(uniqueName: string): number {
  const m = uniqueName.match(/@([1-4])$/)
  if (!m) return 0
  const n = Number(m[1])
  return Number.isFinite(n) ? n : 0
}

function stripEnchantSuffix(uniqueName: string): string {
  return uniqueName.replace(/@[1-4]$/, '')
}

function buildCandidateIds(baseUniqueName: string, tier: number | null): string[] {
  const ids = [baseUniqueName]
  if (tier != null && tier >= 4) {
    for (let ench = 1; ench <= 4; ench += 1) {
      ids.push(`${baseUniqueName}@${ench}`)
    }
  }
  return ids
}

function pickDirectBuyPrice(rows: AodpPriceRow[], city: string): number {
  const pool = rows.filter((r) => r.city === city && r.quality === 1 && r.sell_price_min > 0)
  if (pool.length === 0) return 0
  return Math.min(...pool.map((r) => r.sell_price_min))
}

function pickDirectSellPrice(rows: AodpPriceRow[], city: string): number {
  const pool = rows.filter((r) => r.city === city && r.quality === 1 && r.buy_price_max > 0)
  if (pool.length === 0) return 0
  return Math.max(...pool.map((r) => r.buy_price_max))
}

async function fetchDirectFlipPrices(
  region: AodpRegion,
  itemIds: string[],
  onProgress?: (doneChunks: number, totalChunks: number) => void
): Promise<{ caerleonBuy: Record<string, number>; blackMarketSell: Record<string, number> }> {
  const unique = [...new Set(itemIds)].filter(Boolean)
  const caerleonBuy: Record<string, number> = {}
  const blackMarketSell: Record<string, number> = {}
  if (unique.length === 0) return { caerleonBuy, blackMarketSell }

  const chunkSize = 40
  const base = REGION_PREFIX[region]
  const totalChunks = Math.max(1, Math.ceil(unique.length / chunkSize))
  let doneChunks = 0
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const path = `${base}/api/v2/stats/prices/${encodeURIComponent(chunk.join(','))}.json`
    const res = await fetch(path)
    if (!res.ok) throw new Error(`AODP ${res.status}: ${path}`)
    const data = (await res.json()) as AodpPriceRow[]
    if (!Array.isArray(data)) continue

    const byItem = new Map<string, AodpPriceRow[]>()
    for (const row of data) {
      if (!row?.item_id) continue
      if (!byItem.has(row.item_id)) byItem.set(row.item_id, [])
      byItem.get(row.item_id)!.push(row)
    }

    for (const id of chunk) {
      const rows = byItem.get(id) ?? []
      caerleonBuy[id] = pickDirectBuyPrice(rows, 'Caerleon')
      blackMarketSell[id] = pickDirectSellPrice(rows, 'Black Market')
    }
    doneChunks += 1
    onProgress?.(doneChunks, totalChunks)
  }

  return { caerleonBuy, blackMarketSell }
}

function formatSilver(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

async function loadItemNamesData(): Promise<ItemNameMap> {
  const res = await fetch('/data/item_names_en.json')
  if (!res.ok) return {}
  const raw = (await res.json()) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as ItemNameMap
}

function categoryFolder(category: CombatCategory): CombatCategory {
  return category
}

export function BlackMarketFlip() {
  const mountedRef = useRef(true)
  const [region, setRegion] = useState<AodpRegion>('asia')
  const [query, setQuery] = useState('')
  const [taxPct, setTaxPct] = useState(6.0)
  const [minProfit, setMinProfit] = useState(0)
  const [activeCategories, setActiveCategories] = useState<Record<CombatCategory, boolean>>({
    weapons: true,
    offhands: true,
    head: true,
    chest: true,
    boots: true,
  })
  const [candidates, setCandidates] = useState<FlipCandidate[]>([])
  const [itemNames, setItemNames] = useState<ItemNameMap | null>(null)
  const [rows, setRows] = useState<FlipRow[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [names, payloads] = await Promise.all([
          loadItemNamesData(),
          Promise.all(
            CATEGORY_CONFIG.map(async (cfg) => {
              const res = await fetch(cfg.recipeUrl)
              if (!res.ok) throw new Error(`${cfg.id} ${res.status}`)
              const payload = (await res.json()) as RecipePayload
              return { cfg, payload }
            })
          ),
        ])
        if (cancelled) return

        const byId = new Map<string, FlipCandidate>()
        for (const { cfg, payload } of payloads) {
          const recipes = Array.isArray(payload.recipes) ? payload.recipes : []
          for (const recipe of recipes) {
            const baseId = recipe.uniqueName
            if (!baseId) continue
            const tier = recipe.tier ?? tierFromUniqueName(baseId)
            for (const id of buildCandidateIds(baseId, tier)) {
              if (byId.has(id)) continue
              byId.set(id, {
                uniqueName: id,
                baseUniqueName: baseId,
                category: cfg.id,
                tier,
              })
            }
          }
        }
        setItemNames(names)
        setCandidates([...byId.values()])
      } catch (error) {
        if (cancelled) return
        setStatus('error')
        setStatusMsg(error instanceof Error ? error.message : 'Failed to load item list')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredCandidates = useMemo(() => {
    return candidates.filter((item) => {
      if (!activeCategories[item.category]) return false
      if (!itemMatchesSearchQuery(item.baseUniqueName, query.trim().toLowerCase(), itemNames)) return false
      return true
    })
  }, [candidates, activeCategories, query, itemNames])

  const visibleRows = useMemo(() => {
    return rows
      .filter((row) => {
        const isInCategory = activeCategories[row.category]
        if (!isInCategory) return false
        if (!itemMatchesSearchQuery(row.baseUniqueName, query.trim().toLowerCase(), itemNames)) return false
        if (row.caerleonBuy <= 0 || row.blackMarketSell <= 0) return false
        if (row.profit <= 0) return false
        if (row.profit < minProfit) return false
        return true
      })
      .sort((a, b) => {
        if (b.profit !== a.profit) return b.profit - a.profit
        return a.uniqueName.localeCompare(b.uniqueName)
      })
  }, [rows, activeCategories, query, itemNames, minProfit])

  const fetchComparison = async () => {
    const itemIds = filteredCandidates.map((c) => c.uniqueName)
    if (itemIds.length === 0) {
      setRows([])
      setStatus('ok')
      setStatusMsg('No matching items for current filters.')
      return
    }

    setStatus('loading')
    setStatusMsg('Fetching items...')
    startBlackMarketFetch('0%')
    try {
      setBlackMarketFetchPhase('5%', 1)
      const priceMap = await fetchDirectFlipPrices(region, itemIds, (doneChunks, totalChunks) => {
        const pct = Math.min(90, Math.max(5, Math.round((doneChunks / Math.max(1, totalChunks)) * 85 + 5)))
        setBlackMarketFetchPhase(`${pct}%`, 1)
      })
      setBlackMarketFetchPhase('93%', 2)
      const taxRate = Math.max(0, Math.min(100, taxPct)) / 100
      const nextRows: FlipRow[] = filteredCandidates.map((item) => {
        const caerleonBuy = priceMap.caerleonBuy[item.uniqueName] ?? 0
        const blackMarketSell = priceMap.blackMarketSell[item.uniqueName] ?? 0
        const grossSpread = blackMarketSell - caerleonBuy
        const netSell = blackMarketSell * (1 - taxRate)
        const profit = netSell - caerleonBuy
        const marginPct = caerleonBuy > 0 ? (profit / caerleonBuy) * 100 : 0
        return {
          ...item,
          caerleonBuy,
          blackMarketSell,
          grossSpread,
          netSell,
          profit,
          marginPct,
        }
      })
      setBlackMarketFetchPhase('99%', 3)
      const queryLower = query.trim().toLowerCase()
      const visible = nextRows.filter((row) => {
        if (!activeCategories[row.category]) return false
        if (!itemMatchesSearchQuery(row.baseUniqueName, queryLower, itemNames)) return false
        if (row.caerleonBuy <= 0 || row.blackMarketSell <= 0) return false
        if (row.profit <= 0) return false
        if (row.profit < minProfit) return false
        return true
      }).length
      const successMessage = `Black Market comparison finished. Showing ${visible} visible flip rows.`
      if (mountedRef.current) {
        setRows(nextRows)
        setStatus('ok')
        setStatusMsg(`Compared ${nextRows.length} items. Showing ${visible} visible rows.`)
      }
      finishBlackMarketFetch(successMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Price fetch failed'
      if (mountedRef.current) {
        setStatus('error')
        setStatusMsg(message)
      }
      failBlackMarketFetch(`Black Market comparison failed: ${message}`)
    }
  }

  return (
    <div className="planner">
      <section className="panel black-flip">
        <div className="row spread black-flip__head">
          <div>
            <h2>Black Market Flip</h2>
            <p className="muted black-flip__subtitle">
              Compare Caerleon buy prices vs Black Market sell prices for combat gear.
            </p>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() => void fetchComparison()}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Fetching...' : 'Fetch Comparison'}
          </button>
        </div>

        <div className="black-flip__controls">
          <label className="field inline market-field">
            <span className="muted">Region</span>
            <select className="input input--market" value={region} onChange={(e) => setRegion(e.target.value as AodpRegion)}>
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field inline market-field">
            <span className="muted">Market Tax %</span>
            <input
              type="number"
              className="input input--market"
              min={0}
              max={100}
              step={0.1}
              value={taxPct}
              onChange={(e) => setTaxPct(Number(e.target.value || 0))}
            />
          </label>

          <label className="field inline market-field">
            <span className="muted">Min Profit</span>
            <input
              type="number"
              className="input input--market"
              min={0}
              step={100}
              value={minProfit}
              onChange={(e) => setMinProfit(Math.max(0, Number(e.target.value || 0)))}
            />
          </label>

          <label className="field inline market-field black-flip__search">
            <span className="muted">Search Item</span>
            <input
              type="search"
              className="input input--market"
              placeholder="Search by item name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        <div className="black-flip__categories">
          {CATEGORY_CONFIG.map((cfg) => (
            <label key={cfg.id} className="black-flip__category-toggle">
              <input
                type="checkbox"
                checked={activeCategories[cfg.id]}
                onChange={(e) =>
                  setActiveCategories((prev) => ({
                    ...prev,
                    [cfg.id]: e.target.checked,
                  }))
                }
              />
              <span>{cfg.label}</span>
            </label>
          ))}
        </div>

        <div className="market-feedback" aria-live="polite">
          {statusMsg ? (
            <p
              className={`market-feedback__msg${
                status === 'error' ? ' is-error' : status === 'ok' ? ' is-success' : ''
              }`}
            >
              {statusMsg}
            </p>
          ) : (
            <p className="market-feedback__msg is-idle" aria-hidden />
          )}
        </div>

        <div className="card-scroll card-scroll--table" role="region" aria-label="Black market flip comparison">
          <div className="table-wrap">
            <table className="cost-table black-flip__table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Caerleon Buy</th>
                  <th>Black Market Sell</th>
                  <th>Gross Spread</th>
                  <th>Net Sell (After Tax)</th>
                  <th>Profit</th>
                  <th>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length > 0 ? (
                  visibleRows.map((row) => (
                    <tr key={row.uniqueName}>
                      <td>
                        <div className="resource-cell">
                          <ItemIcon
                            uniqueName={stripEnchantSuffix(row.uniqueName)}
                            enchantmentLevel={parseEnchantFromId(row.uniqueName)}
                            localFolder={categoryFolder(row.category)}
                            size={28}
                            className="item-icon--table"
                            alt=""
                            hoverLabel={summarizeItemHoverLabel(row.uniqueName, undefined, itemNames)}
                          />
                          <span className="item-display">
                            {summarizeItemHoverLabel(row.uniqueName, undefined, itemNames)}
                          </span>
                        </div>
                      </td>
                      <td>{formatSilver(row.caerleonBuy)}</td>
                      <td>{formatSilver(row.blackMarketSell)}</td>
                      <td className={row.grossSpread >= 0 ? 'black-flip__pos' : 'black-flip__neg'}>
                        {formatSilver(row.grossSpread)}
                      </td>
                      <td>{formatSilver(row.netSell)}</td>
                      <td className={row.profit >= 0 ? 'black-flip__pos' : 'black-flip__neg'}>
                        {formatSilver(row.profit)}
                      </td>
                      <td className={row.marginPct >= 0 ? 'black-flip__pos' : 'black-flip__neg'}>
                        {row.marginPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="cost-table__empty">
                    <td colSpan={7}>Run fetch to compare markets and show flip opportunities.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
