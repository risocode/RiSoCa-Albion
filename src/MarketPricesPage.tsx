import { useEffect, useMemo, useRef, useState } from 'react'
import { ItemIcon } from './ItemIcon'
import { fetchMarketPrices, type MarketPriceRow, type MarketRegion, type MarketSort } from './supabaseMarket'

const TIER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const
const ENCHANT_OPTIONS = [0, 1, 2, 3, 4] as const
const REGION_OPTIONS: Array<{ value: MarketRegion; label: string }> = [
  { value: 'all', label: 'All Regions' },
  { value: 'asia', label: 'Asia' },
  { value: 'europe', label: 'Europe' },
  { value: 'americas', label: 'Americas' },
]
const SORT_OPTIONS: Array<{ value: MarketSort; label: string }> = [
  { value: 'updated_desc', label: 'Last Updated' },
  { value: 'price_asc', label: 'Price Lowest' },
  { value: 'price_desc', label: 'Price Highest' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
]
const AUTO_REFRESH_MS = 5 * 60 * 1000
const CITY_CHIPS = [
  'Bridgewatch',
  'Martlock',
  'Thetford',
  'Fort Sterling',
  'Lymhurst',
  'Caerleon',
  'Brecilien',
  'Black Market',
] as const

function formatSilver(value: number): string {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function albionUtcSlotLabel(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '--'
  const utcHour = d.getUTCHours()
  const slot = Math.floor(utcHour / 6) * 6
  if (slot === 0) return '00:00 UTC'
  if (slot === 6) return '06:00 UTC'
  if (slot === 12) return '12:00 UTC'
  return '18:00 UTC'
}

function formatUtcTooltip(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '--'
  return d.toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }) + ' UTC'
}

function deriveCategory(uniqueName: string): string {
  const id = uniqueName.toUpperCase()
  if (id.includes('_BAG') || id.includes('SATCHEL')) return 'Bags'
  if (id.includes('_MAIN_') || id.includes('_2H_')) return 'Weapons'
  if (id.includes('_ARMOR_') || id.includes('_HEAD_') || id.includes('_SHOES_')) return 'Armor'
  if (id.includes('_OFF_')) return 'Off-hands'
  if (id.includes('_POTION_') || id.includes('FOCUSPOTION')) return 'Potions'
  if (id.includes('_MEAL_')) return 'Food'
  if (id.includes('_CLOTH') || id.includes('_LEATHER') || id.includes('_METALBAR') || id.includes('_PLANKS') || id.includes('_STONEBLOCK')) {
    return 'Refined'
  }
  return 'Misc'
}

function deriveType(uniqueName: string): string {
  const id = uniqueName.toUpperCase()
  const pretty = (token: string): string =>
    token
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((w) => w[0]!.toUpperCase() + w.slice(1))
      .join(' ')

  if (id.includes('_2H_BOW')) return 'Bow'
  if (id.includes('_2H_CROSSBOW')) return 'Crossbow'
  if (id.includes('_MAIN_SWORD')) return 'Sword'
  if (id.includes('_MAIN_AXE')) return 'Axe'
  if (id.includes('_MAIN_DAGGER')) return 'Dagger'
  if (id.includes('_MAIN_HAMMER')) return 'Hammer'
  if (id.includes('_MAIN_MACE')) return 'Mace'
  if (id.includes('_MAIN_SPEAR')) return 'Spear'
  if (id.includes('_2H_QUARTERSTAFF')) return 'Quarterstaff'
  if (id.includes('_2H_KNUCKLES')) return 'War Gloves'
  if (id.includes('_MAIN_ARCANESTAFF')) return 'Arcane Staff'
  if (id.includes('_MAIN_CURSEDSTAFF')) return 'Cursed Staff'
  if (id.includes('_MAIN_FIRESTAFF')) return 'Fire Staff'
  if (id.includes('_MAIN_FROSTSTAFF')) return 'Frost Staff'
  if (id.includes('_MAIN_HOLYSTAFF')) return 'Holy Staff'
  if (id.includes('_MAIN_NATURESTAFF')) return 'Nature Staff'
  if (id.includes('_2H_SHAPESHIFTER')) return 'Shapeshifter Staff'

  if (id.includes('_OFF_SHIELD') || id.includes('_OFF_TOWERSHIELD') || id.includes('_OFF_SPIKEDSHIELD')) return 'Shield'
  if (id.includes('_OFF_BOOK') || id.includes('_OFF_TOME')) return 'Book'
  if (id.includes('_OFF_TORCH')) return 'Torch'
  if (id.includes('_OFF_ORB')) return 'Orb'
  if (id.includes('_OFF_CENSER')) return 'Censer'
  if (id.includes('_OFF_TALISMAN')) return 'Talisman'
  if (id.includes('_OFF_TOTEM')) return 'Totem'
  if (id.includes('_OFF_DEMONSKULL')) return 'Demon Skull'
  if (id.includes('_OFF_HORN')) return 'Horn'
  if (id.includes('_OFF_JESTERCANE')) return 'Jester Cane'
  if (id.includes('_OFF_LAMP')) return 'Lamp'

  if (id.includes('_HEAD_CLOTH')) return 'Cloth Hood'
  if (id.includes('_HEAD_LEATHER')) return 'Leather Hood'
  if (id.includes('_HEAD_PLATE')) return 'Plate Helmet'

  if (id.includes('_ARMOR_CLOTH')) return 'Cloth Robe'
  if (id.includes('_ARMOR_LEATHER')) return 'Leather Jacket'
  if (id.includes('_ARMOR_PLATE')) return 'Plate Armor'

  if (id.includes('_SHOES_CLOTH')) return 'Cloth Sandals'
  if (id.includes('_SHOES_LEATHER')) return 'Leather Shoes'
  if (id.includes('_SHOES_PLATE')) return 'Plate Boots'

  if (id.includes('_BAG') || id.includes('SATCHEL')) return 'Bag'
  if (id.includes('_POTION_') || id.includes('FOCUSPOTION')) return 'Potion'
  if (id.includes('_MEAL_')) return 'Food'
  if (id.includes('_CLOTH')) return 'Cloth'
  if (id.includes('_LEATHER')) return 'Leather'
  if (id.includes('_METALBAR')) return 'Metal Bar'
  if (id.includes('_PLANKS')) return 'Planks'
  if (id.includes('_STONEBLOCK')) return 'Stone Block'

  const weaponMain = id.match(/_MAIN_([A-Z0-9_]+)/)
  if (weaponMain) return pretty(weaponMain[1])
  const weapon2h = id.match(/_2H_([A-Z0-9_]+)/)
  if (weapon2h) return pretty(weapon2h[1])
  const headType = id.match(/_HEAD_([A-Z0-9_]+)/)
  if (headType) return `Head ${pretty(headType[1])}`
  const chestType = id.match(/_ARMOR_([A-Z0-9_]+)/)
  if (chestType) return `Armor ${pretty(chestType[1])}`
  const bootType = id.match(/_SHOES_([A-Z0-9_]+)/)
  if (bootType) return `Shoes ${pretty(bootType[1])}`

  return 'Other'
}

function folderForItem(uniqueName: string): 'weapons' | 'offhands' | 'head' | 'chest' | 'boots' | 'resources' | 'alchemist' | 'cooking' {
  const id = uniqueName.toUpperCase()
  if (id.includes('_MAIN_') || id.includes('_2H_')) return 'weapons'
  if (id.includes('_OFF_')) return 'offhands'
  if (id.includes('_HEAD_')) return 'head'
  if (id.includes('_ARMOR_')) return 'chest'
  if (id.includes('_SHOES_')) return 'boots'
  if (id.includes('_POTION_') || id.includes('FOCUSPOTION')) return 'alchemist'
  if (id.includes('_MEAL_')) return 'cooking'
  return 'resources'
}

export function MarketPricesPage() {
  const tableRegionRef = useRef<HTMLDivElement | null>(null)
  const [rows, setRows] = useState<MarketPriceRow[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const [hasRegionMetadata, setHasRegionMetadata] = useState(true)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('all')
  const [category, setCategory] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [tier, setTier] = useState<number | null>(null)
  const [enchant, setEnchant] = useState<number | null>(null)
  const [region, setRegion] = useState<MarketRegion>('all')
  const [sort, setSort] = useState<MarketSort>('updated_desc')

  const categoryOptions = useMemo(() => {
    const set = new Set(rows.map((r) => deriveCategory(r.itemUniqueName)))
    return ['all', ...[...set].sort((a, b) => a.localeCompare(b))]
  }, [rows])
  const typeOptions = useMemo(() => {
    const set = new Set(
      rows
        .filter((r) => category === 'all' || deriveCategory(r.itemUniqueName) === category)
        .map((r) => deriveType(r.itemUniqueName))
    )
    return ['all', ...[...set].sort((a, b) => a.localeCompare(b))]
  }, [rows, category])

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (city !== 'all' && r.city !== city) return false
      if (category !== 'all' && deriveCategory(r.itemUniqueName) !== category) return false
      if (typeFilter !== 'all' && deriveType(r.itemUniqueName) !== typeFilter) return false
      if (tier != null && r.tier !== tier) return false
      if (enchant != null && r.enchantment !== enchant) return false
      if (q) {
        const combined = `${r.itemName} ${r.itemUniqueName}`.toLowerCase()
        if (!combined.includes(q)) return false
      }
      return true
    })
  }, [rows, city, category, typeFilter, tier, enchant, search])

  const fetchRows = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    setStatus('loading')
    if (!silent) setMsg('Fetching market prices...')
    try {
      const result = await fetchMarketPrices({
        city: city === 'all' ? undefined : city,
        tier: tier ?? undefined,
        enchantment: enchant ?? undefined,
        region,
        search,
        sort,
      })
      setRows(result.rows)
      setHasRegionMetadata(result.hasRegionMetadata)
      setStatus('ok')
      setMsg('Prices Refresh every 5 mins')
    } catch (error) {
      setStatus('error')
      setMsg(error instanceof Error ? error.message : 'Failed to load market prices')
    }
  }

  useEffect(() => {
    void fetchRows()
    const timer = window.setInterval(() => {
      void fetchRows({ silent: true })
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="planner">
      <section className="panel market-prices">
        <div className="row spread market-prices__head">
          <div>
            <h2>Market Prices</h2>
            <p className="muted market-prices__subtitle">Browse latest item prices across cities with Albion-style filters.</p>
          </div>
          <div className="market-prices__city-chips" role="group" aria-label="City quick filter">
            {CITY_CHIPS.map((name) => (
              <button
                key={name}
                type="button"
                className={`market-prices__city-chip${city === name ? ' is-active' : ''}`}
                aria-pressed={city === name}
                onClick={() => setCity((prev) => (prev === name ? 'all' : name))}
                data-city={name}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="market-prices__filters">
          <input
            type="search"
            className="input input--market market-prices__search"
            placeholder="Search item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input input--market" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categoryOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'All Categories' : opt}
              </option>
            ))}
          </select>
          <select className="input input--market" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {typeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'All Types' : opt}
              </option>
            ))}
          </select>
          <select
            className="input input--market"
            value={tier == null ? 'all' : String(tier)}
            onChange={(e) => setTier(e.target.value === 'all' ? null : Number(e.target.value))}
          >
            <option value="all">All Tiers</option>
            {TIER_OPTIONS.map((t) => (
              <option key={t} value={t}>
                T{t}
              </option>
            ))}
          </select>
          <select
            className="input input--market"
            value={enchant == null ? 'all' : String(enchant)}
            onChange={(e) => setEnchant(e.target.value === 'all' ? null : Number(e.target.value))}
          >
            <option value="all">All Enchants</option>
            {ENCHANT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select
            className="input input--market"
            value={region}
            onChange={(e) => setRegion(e.target.value as MarketRegion)}
            disabled={!hasRegionMetadata}
            title={!hasRegionMetadata ? 'Region metadata not available in current rows.' : undefined}
          >
            {REGION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select className="input input--market" value={sort} onChange={(e) => setSort(e.target.value as MarketSort)}>
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="market-feedback" aria-live="polite">
          {msg ? (
            <p className={`market-feedback__msg${status === 'error' ? ' is-error' : status === 'ok' ? ' is-success' : ''}`}>
              {msg}
            </p>
          ) : (
            <p className="market-feedback__msg is-idle" aria-hidden />
          )}
        </div>
        {!hasRegionMetadata ? (
          <p className="market-prices__region-note">
            Region filter is disabled because source metadata is missing in current Supabase rows.
          </p>
        ) : null}

        <div
          ref={tableRegionRef}
          className="card-scroll card-scroll--table"
          role="region"
          aria-label="Market prices table"
        >
          <div className="table-wrap">
            <table className="cost-table market-prices__table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Tier</th>
                  <th>Enchant</th>
                  <th>City</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Quality</th>
                  <th>Price</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length > 0 ? (
                  visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="resource-cell">
                          <ItemIcon
                            uniqueName={row.itemUniqueName}
                            enchantmentLevel={row.enchantment > 0 ? row.enchantment : undefined}
                            localFolder={folderForItem(row.itemUniqueName)}
                            size={28}
                            className="item-icon--table"
                            alt=""
                            hoverLabel={`${row.tier}.${row.enchantment} ${row.itemName}`}
                          />
                          <span className="item-display">{row.itemName}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`market-tier-badge market-tier-badge--t${Math.max(1, Math.min(8, row.tier))}`}>
                          T{row.tier}
                        </span>
                      </td>
                      <td>
                        <span className={`market-enchant-badge market-enchant-badge--e${Math.max(0, Math.min(4, row.enchantment))}`}>
                          {row.enchantment}
                        </span>
                      </td>
                      <td>{row.city}</td>
                      <td>{deriveCategory(row.itemUniqueName)}</td>
                      <td>{deriveType(row.itemUniqueName)}</td>
                      <td>Good</td>
                      <td>{formatSilver(row.price)}</td>
                      <td title={formatUtcTooltip(row.postedAt)}>{albionUtcSlotLabel(row.postedAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="cost-table__empty">
                    <td colSpan={9}>Fetch prices to load market data.</td>
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
