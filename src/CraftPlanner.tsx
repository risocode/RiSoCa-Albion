import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchPricesForItems } from './aodp'
import {
  formatItemDisplayName,
  itemMatchesSearchQuery,
  summarizeItemHoverLabel,
  type ItemNameMap,
} from './formatItemName'
import { ItemIcon } from './ItemIcon'
import type { LocalIconFolder } from './itemIconUrl'
import type { AodpRegion, CraftPlannerKind, RecipesPayload } from './types'

const LS_PRICES = 'albion-weapon-craft:unitPrices'
const LS_CRAFT_SETUP = 'albion-weapon-craft:setup'
type CraftSetupState = {
  usageFee: number
  rrr: number
}

const DEFAULT_CRAFT_SETUP: CraftSetupState = {
  usageFee: 1000,
  rrr: 15.25,
}

const RECIPE_URL: Record<CraftPlannerKind, string> = {
  weapons: '/data/weapons_recipes.json',
  head: '/data/head_recipes.json',
  chest: '/data/chest_recipes.json',
  boots: '/data/boots_recipes.json',
  refining_cloth: '/data/refining_cloth_recipes.json',
  refining_leather: '/data/refining_leather_recipes.json',
  refining_metal_bars: '/data/refining_metal_bars_recipes.json',
  refining_stone_block: '/data/refining_stone_block_recipes.json',
  refining_planks: '/data/refining_planks_recipes.json',
  brewing_heal: '/data/brewing_heal_recipes.json',
  brewing_energy: '/data/brewing_energy_recipes.json',
  brewing_gigantify: '/data/brewing_gigantify_recipes.json',
  brewing_resistance: '/data/brewing_resistance_recipes.json',
  brewing_sticky: '/data/brewing_sticky_recipes.json',
  brewing_poison: '/data/brewing_poison_recipes.json',
  brewing_invisibility: '/data/brewing_invisibility_recipes.json',
  brewing_calming: '/data/brewing_calming_recipes.json',
  brewing_cleansing: '/data/brewing_cleansing_recipes.json',
  brewing_acid: '/data/brewing_acid_recipes.json',
  brewing_berserk: '/data/brewing_berserk_recipes.json',
  brewing_hellfire: '/data/brewing_hellfire_recipes.json',
  brewing_gathering: '/data/brewing_gathering_recipes.json',
  brewing_tornado: '/data/brewing_tornado_recipes.json',
  brewing_focus: '/data/brewing_focus_recipes.json',
}

const recipeCache: Partial<Record<CraftPlannerKind, RecipesPayload>> = {}
const recipePromiseCache: Partial<Record<CraftPlannerKind, Promise<RecipesPayload>>> = {}
let namesCache: ItemNameMap | null = null
let namesPromiseCache: Promise<ItemNameMap> | null = null

function loadRecipeData(kind: CraftPlannerKind): Promise<RecipesPayload> {
  const cached = recipeCache[kind]
  if (cached) return Promise.resolve(cached)
  const inflight = recipePromiseCache[kind]
  if (inflight) return inflight

  const p = (async () => {
    const res = await fetch(RECIPE_URL[kind])
    if (!res.ok) throw new Error(`${res.status}`)
    const data = (await res.json()) as RecipesPayload
    recipeCache[kind] = data
    return data
  })()

  recipePromiseCache[kind] = p
  return p
}

function loadItemNamesData(): Promise<ItemNameMap> {
  if (namesCache) return Promise.resolve(namesCache)
  if (namesPromiseCache) return namesPromiseCache

  namesPromiseCache = (async () => {
    const res = await fetch('/data/item_names_en.json')
    if (!res.ok) return {}
    try {
      const raw = await res.json()
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        namesCache = raw as ItemNameMap
        return namesCache
      }
    } catch {
      /* ignore invalid name map */
    }
    namesCache = {}
    return namesCache
  })()

  return namesPromiseCache
}

type SectionUi = {
  panelTitle: string
  itemSingular: string
  itemPlural: string
  searchPlaceholder: string
  searchAria: string
  listAria: string
  searchIcon: string
  searchIconSrc?: string
  searchIconItemId?: string
  emptyList: string
  pickPrompt: string
  selectionLabel: string
}

const SECTION_UI: Record<CraftPlannerKind, SectionUi> = {
  weapons: {
    panelTitle: 'Armory',
    itemSingular: 'weapon',
    itemPlural: 'weapons',
    searchPlaceholder: 'Search weapons…',
    searchAria: 'Filter weapons',
    listAria: 'Weapon list',
    searchIcon: '⚔',
    searchIconSrc: '/weapon.png',
    emptyList: 'No weapons match that search.',
    pickPrompt: 'Choose a weapon from the list to view resources and silver totals.',
    selectionLabel: 'Selected weapon',
  },
  head: {
    panelTitle: 'Head',
    itemSingular: 'item',
    itemPlural: 'items',
    searchPlaceholder: 'Search head armor…',
    searchAria: 'Filter head armor',
    listAria: 'Head armor list',
    searchIcon: '⛑',
    searchIconSrc: '/head.png',
    emptyList: 'No head armor matches that search.',
    pickPrompt: 'Choose a head piece from the list to view resources and silver totals.',
    selectionLabel: 'Selected head piece',
  },
  chest: {
    panelTitle: 'Chest',
    itemSingular: 'item',
    itemPlural: 'items',
    searchPlaceholder: 'Search chest armor…',
    searchAria: 'Filter chest armor',
    listAria: 'Chest armor list',
    searchIcon: '🛡',
    searchIconSrc: '/chests.png',
    emptyList: 'No chest armor matches that search.',
    pickPrompt: 'Choose chest armor from the list to view resources and silver totals.',
    selectionLabel: 'Selected chest piece',
  },
  boots: {
    panelTitle: 'Boots',
    itemSingular: 'item',
    itemPlural: 'items',
    searchPlaceholder: 'Search boots…',
    searchAria: 'Filter boots',
    listAria: 'Boots list',
    searchIcon: '👢',
    searchIconSrc: '/boots.png',
    emptyList: 'No boots match that search.',
    pickPrompt: 'Choose boots from the list to view resources and silver totals.',
    selectionLabel: 'Selected boots',
  },
  refining_cloth: {
    panelTitle: 'Refining · Cloth',
    itemSingular: 'material',
    itemPlural: 'materials',
    searchPlaceholder: 'Search cloth…',
    searchAria: 'Filter cloth',
    listAria: 'Cloth list',
    searchIcon: '🧵',
    searchIconItemId: 'T8_CLOTH',
    emptyList: 'No cloth recipe matches that search.',
    pickPrompt: 'Choose a cloth output to view refining resources and silver totals.',
    selectionLabel: 'Selected cloth',
  },
  refining_leather: {
    panelTitle: 'Refining · Leather',
    itemSingular: 'material',
    itemPlural: 'materials',
    searchPlaceholder: 'Search leather…',
    searchAria: 'Filter leather',
    listAria: 'Leather list',
    searchIcon: '🧷',
    searchIconItemId: 'T8_LEATHER',
    emptyList: 'No leather recipe matches that search.',
    pickPrompt: 'Choose a leather output to view refining resources and silver totals.',
    selectionLabel: 'Selected leather',
  },
  refining_metal_bars: {
    panelTitle: 'Refining · Metal Bars',
    itemSingular: 'material',
    itemPlural: 'materials',
    searchPlaceholder: 'Search metal bars…',
    searchAria: 'Filter metal bars',
    listAria: 'Metal bar list',
    searchIcon: '⚒',
    searchIconItemId: 'T8_METALBAR',
    emptyList: 'No metal bar recipe matches that search.',
    pickPrompt: 'Choose a metal bar output to view refining resources and silver totals.',
    selectionLabel: 'Selected metal bar',
  },
  refining_stone_block: {
    panelTitle: 'Refining · Stone Block',
    itemSingular: 'material',
    itemPlural: 'materials',
    searchPlaceholder: 'Search stone blocks…',
    searchAria: 'Filter stone blocks',
    listAria: 'Stone block list',
    searchIcon: '🪨',
    searchIconItemId: 'T8_STONEBLOCK',
    emptyList: 'No stone block recipe matches that search.',
    pickPrompt: 'Choose a stone block output to view refining resources and silver totals.',
    selectionLabel: 'Selected stone block',
  },
  refining_planks: {
    panelTitle: 'Refining · Planks',
    itemSingular: 'material',
    itemPlural: 'materials',
    searchPlaceholder: 'Search planks…',
    searchAria: 'Filter planks',
    listAria: 'Planks list',
    searchIcon: '🪵',
    searchIconItemId: 'T8_PLANKS',
    emptyList: 'No plank recipe matches that search.',
    pickPrompt: 'Choose a plank output to view refining resources and silver totals.',
    selectionLabel: 'Selected plank',
  },
  brewing_heal: {
    panelTitle: 'Alchemist Lab · Heal',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search heal potions…',
    searchAria: 'Filter heal potions',
    listAria: 'Heal potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T6_POTION_HEAL',
    emptyList: 'No heal potion recipe matches that search.',
    pickPrompt: 'Choose a heal potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected heal potion',
  },
  brewing_energy: {
    panelTitle: 'Alchemist Lab · Energy',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search energy potions…',
    searchAria: 'Filter energy potions',
    listAria: 'Energy potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T6_POTION_ENERGY',
    emptyList: 'No energy potion recipe matches that search.',
    pickPrompt: 'Choose an energy potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected energy potion',
  },
  brewing_gigantify: {
    panelTitle: 'Alchemist Lab · Gigantify',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search gigantify potions…',
    searchAria: 'Filter gigantify potions',
    listAria: 'Gigantify potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T7_POTION_REVIVE',
    emptyList: 'No gigantify potion recipe matches that search.',
    pickPrompt: 'Choose a gigantify potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected gigantify potion',
  },
  brewing_resistance: {
    panelTitle: 'Alchemist Lab · Resistance',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search resistance potions…',
    searchAria: 'Filter resistance potions',
    listAria: 'Resistance potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T7_POTION_STONESKIN',
    emptyList: 'No resistance potion recipe matches that search.',
    pickPrompt: 'Choose a resistance potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected resistance potion',
  },
  brewing_sticky: {
    panelTitle: 'Alchemist Lab · Sticky',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search sticky potions…',
    searchAria: 'Filter sticky potions',
    listAria: 'Sticky potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T7_POTION_SLOWFIELD',
    emptyList: 'No sticky potion recipe matches that search.',
    pickPrompt: 'Choose a sticky potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected sticky potion',
  },
  brewing_poison: {
    panelTitle: 'Alchemist Lab · Poison',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search poison potions…',
    searchAria: 'Filter poison potions',
    listAria: 'Poison potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T8_POTION_COOLDOWN',
    emptyList: 'No poison potion recipe matches that search.',
    pickPrompt: 'Choose a poison potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected poison potion',
  },
  brewing_invisibility: {
    panelTitle: 'Alchemist Lab · Invisibility',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search invisibility potions…',
    searchAria: 'Filter invisibility potions',
    listAria: 'Invisibility potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T8_POTION_CLEANSE',
    emptyList: 'No invisibility potion recipe matches that search.',
    pickPrompt: 'Choose an invisibility potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected invisibility potion',
  },
  brewing_calming: {
    panelTitle: 'Alchemist Lab · Calming',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search calming potions…',
    searchAria: 'Filter calming potions',
    listAria: 'Calming potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T7_POTION_MOB_RESET',
    emptyList: 'No calming potion recipe matches that search.',
    pickPrompt: 'Choose a calming potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected calming potion',
  },
  brewing_cleansing: {
    panelTitle: 'Alchemist Lab · Cleansing',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search cleansing potions…',
    searchAria: 'Filter cleansing potions',
    listAria: 'Cleansing potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T7_POTION_CLEANSE2',
    emptyList: 'No cleansing potion recipe matches that search.',
    pickPrompt: 'Choose a cleansing potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected cleansing potion',
  },
  brewing_acid: {
    panelTitle: 'Alchemist Lab · Acid',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search acid potions…',
    searchAria: 'Filter acid potions',
    listAria: 'Acid potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T7_POTION_ACID',
    emptyList: 'No acid potion recipe matches that search.',
    pickPrompt: 'Choose an acid potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected acid potion',
  },
  brewing_berserk: {
    panelTitle: 'Alchemist Lab · Berserk',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search berserk potions…',
    searchAria: 'Filter berserk potions',
    listAria: 'Berserk potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T8_POTION_BERSERK',
    emptyList: 'No berserk potion recipe matches that search.',
    pickPrompt: 'Choose a berserk potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected berserk potion',
  },
  brewing_hellfire: {
    panelTitle: 'Alchemist Lab · Hellfire',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search hellfire potions…',
    searchAria: 'Filter hellfire potions',
    listAria: 'Hellfire potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T8_POTION_LAVA',
    emptyList: 'No hellfire potion recipe matches that search.',
    pickPrompt: 'Choose a hellfire potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected hellfire potion',
  },
  brewing_gathering: {
    panelTitle: 'Alchemist Lab · Gathering',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search gathering potions…',
    searchAria: 'Filter gathering potions',
    listAria: 'Gathering potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T8_POTION_GATHER',
    emptyList: 'No gathering potion recipe matches that search.',
    pickPrompt: 'Choose a gathering potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected gathering potion',
  },
  brewing_tornado: {
    panelTitle: 'Alchemist Lab · Tornado',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search tornado potions…',
    searchAria: 'Filter tornado potions',
    listAria: 'Tornado potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T8_POTION_TORNADO',
    emptyList: 'No tornado potion recipe matches that search.',
    pickPrompt: 'Choose a tornado potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected tornado potion',
  },
  brewing_focus: {
    panelTitle: 'Alchemist Lab · Focus',
    itemSingular: 'potion',
    itemPlural: 'potions',
    searchPlaceholder: 'Search focus potions…',
    searchAria: 'Filter focus potions',
    listAria: 'Focus potion list',
    searchIcon: '🧪',
    searchIconItemId: 'T8_FOCUSPOTION_NONTRADABLE',
    emptyList: 'No focus potion recipe matches that search.',
    pickPrompt: 'Choose a focus potion to view alchemy resources and silver totals.',
    selectionLabel: 'Selected focus potion',
  },
}

function isArmorCraftKind(
  kind: CraftPlannerKind
): kind is 'weapons' | 'head' | 'chest' | 'boots' {
  return kind === 'weapons' || kind === 'head' || kind === 'chest' || kind === 'boots'
}

function isBrewingKind(kind: CraftPlannerKind): kind is Extract<CraftPlannerKind, `brewing_${string}`> {
  return kind.startsWith('brewing_')
}

function loadStoredPrices(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_PRICES)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(o)) {
      const n = Number(v)
      if (!Number.isNaN(n) && n >= 0) out[k] = n
    }
    return out
  } catch {
    return {}
  }
}

function saveStoredPrices(p: Record<string, number>) {
  localStorage.setItem(LS_PRICES, JSON.stringify(p))
}

function formatSilver(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

const TIER_VALUES = [1, 2, 3, 4, 5, 6, 7, 8] as const
const ENCHANT_DISPLAY = [0, 1, 2, 3, 4] as const

function withRefinedEnchant(uniqueName: string, enchant: number): string {
  if (enchant < 1 || enchant > 4) return uniqueName
  const m = uniqueName.match(
    /^(T\d+_(?:CLOTH|LEATHER|METALBAR|PLANKS|STONEBLOCK))(?:_LEVEL\d+)?$/
  )
  if (!m) return uniqueName
  return `${m[1]}_LEVEL${enchant}`
}

function tierVibeClass(tier?: number): string {
  if (tier == null) return ''
  if (tier < 4 || tier > 8) return ''
  return `selection-banner--tier${tier}`
}

function loadStoredSetup(): CraftSetupState {
  try {
    const raw = localStorage.getItem(LS_CRAFT_SETUP)
    if (!raw) return DEFAULT_CRAFT_SETUP
    const parsed = JSON.parse(raw) as Partial<CraftSetupState>
    return {
      usageFee:
        typeof parsed.usageFee === 'number' && Number.isFinite(parsed.usageFee)
          ? Math.max(0, parsed.usageFee)
          : DEFAULT_CRAFT_SETUP.usageFee,
      rrr:
        typeof parsed.rrr === 'number' && Number.isFinite(parsed.rrr)
          ? Math.max(0, Math.min(100, parsed.rrr))
          : DEFAULT_CRAFT_SETUP.rrr,
    }
  } catch {
    return DEFAULT_CRAFT_SETUP
  }
}

function saveStoredSetup(setup: CraftSetupState) {
  localStorage.setItem(LS_CRAFT_SETUP, JSON.stringify(setup))
}

function tierEnchantPrefix(uniqueName: string): string {
  const tierMatch = uniqueName.match(/^T(\d+)_/)
  if (!tierMatch) return ''
  const enchantMatch = uniqueName.match(/_LEVEL([1-4])$/)
  const enchant = enchantMatch ? Number(enchantMatch[1]) : 0
  return `${tierMatch[1]}.${enchant}`
}

function potionTierFamilyKey(uniqueName: string): string {
  return uniqueName.replace(/^T\d+_/, '').replace(/_LEVEL\d+$/, '')
}

function ItemCell({
  uniqueName,
  itemNames,
}: {
  uniqueName: string
  itemNames: ItemNameMap | null
}) {
  return (
    <td>
      <div className="resource-cell">
        <ItemIcon
          uniqueName={uniqueName}
          localFolder="resources"
          size={28}
          className="item-icon--table"
          alt=""
          hoverLabel={summarizeItemHoverLabel(uniqueName, undefined, itemNames)}
        />
        <span className="item-display">
          {formatItemDisplayName(uniqueName, itemNames)}
        </span>
      </div>
    </td>
  )
}

export function CraftPlanner({ kind }: { kind: CraftPlannerKind }) {
  const ui = SECTION_UI[kind]
  const supportsPreviewEnchant = isArmorCraftKind(kind)
  const isRefiningSection = kind.startsWith('refining_')
  const outputLocalFolder: LocalIconFolder = isArmorCraftKind(kind)
    ? kind
    : isBrewingKind(kind)
      ? 'alchemist'
      : 'resources'
  const initialSetup = useMemo(() => loadStoredSetup(), [])

  const [payload, setPayload] = useState<RecipesPayload | null>(() => recipeCache[kind] ?? null)
  const [itemNames, setItemNames] = useState<ItemNameMap | null>(() => namesCache)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>(() => loadStoredPrices())
  const [ownedByRecipe, setOwnedByRecipe] = useState<
    Record<string, Record<string, number>>
  >({})
  const [region, setRegion] = useState<AodpRegion>('asia')
  const [priceFetchStatus, setPriceFetchStatus] = useState<
    'idle' | 'loading' | 'ok' | 'err'
  >('idle')
  const [priceFetchMsg, setPriceFetchMsg] = useState('')
  const [showPriceFetchFeedback, setShowPriceFetchFeedback] = useState(false)
  const [showCraftSetup, setShowCraftSetup] = useState(false)
  const shouldCloseCraftSetupOnClickRef = useRef(false)
  const [craftQty, setCraftQty] = useState(1)
  const [usageFee, setUsageFee] = useState(initialSetup.usageFee)
  const [rrr, setRrr] = useState(initialSetup.rrr)
  /** `null` = all tiers. Toggle same tier again to clear. */
  const [tierFilter, setTierFilter] = useState<number | null>(null)
  /** List icon enchant (render @N). Used when `tierFilter >= 4`. */
  const [listEnchantView, setListEnchantView] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [data, names] = await Promise.all([loadRecipeData(kind), loadItemNamesData()])
        if (!cancelled) {
          setPayload(data)
          setItemNames(names)
          setLoadError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load recipes')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [kind])

  const recipes = useMemo(() => payload?.recipes ?? [], [payload])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return recipes.filter((r) => {
      if (!isBrewingKind(kind) && tierFilter != null && r.tier !== tierFilter) return false
      return itemMatchesSearchQuery(r.uniqueName, q, itemNames)
    })
  }, [recipes, query, tierFilter, itemNames, kind])

  const listIconEnchant =
    supportsPreviewEnchant && tierFilter != null && tierFilter >= 4 && listEnchantView > 0
      ? listEnchantView
      : undefined

  const selected = useMemo(
    () => recipes.find((r) => r.uniqueName === selectedId) ?? null,
    [recipes, selectedId]
  )

  const selectedBrewingTiers = useMemo(() => {
    if (!isBrewingKind(kind) || !selected) return []
    const family = potionTierFamilyKey(selected.uniqueName)
    return recipes
      .filter((r) => potionTierFamilyKey(r.uniqueName) === family)
      .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))
  }, [kind, selected, recipes])

  const owned = useMemo(() => {
    if (!selectedId) return {}
    return ownedByRecipe[selectedId] ?? {}
  }, [selectedId, ownedByRecipe])

  const setUnitPrice = useCallback((id: string, value: number) => {
    setUnitPrices((prev) => {
      const next = { ...prev, [id]: value }
      saveStoredPrices(next)
      return next
    })
  }, [])

  const setOwnedQty = useCallback((resourceId: string, value: number) => {
    if (!selectedId) return
    const qty = Math.max(0, Math.floor(value))
    setOwnedByRecipe((prev) => ({
      ...prev,
      [selectedId]: {
        ...(prev[selectedId] ?? {}),
        [resourceId]: qty,
      },
    }))
  }, [selectedId])

  const rows = useMemo(() => {
    if (!selected) return []
    const craftEnchant =
      supportsPreviewEnchant &&
      selected.tier != null &&
      selected.tier >= 4 &&
      listEnchantView > 0
        ? listEnchantView
        : 0

    return selected.resources.map((r) => {
      const resourceId = withRefinedEnchant(r.uniqueName, craftEnchant)
      const requiredQty = r.count * craftQty
      const needBuy = Math.max(0, requiredQty - (owned[resourceId] ?? 0))
      const unit = unitPrices[resourceId] ?? 0
      const line = needBuy * unit
      return { ...r, uniqueName: resourceId, requiredQty, needBuy, unit, line }
    })
  }, [selected, owned, unitPrices, supportsPreviewEnchant, listEnchantView, craftQty])

  const matsTotal = rows.reduce((s, r) => s + r.line, 0)
  const baseStationSilver = selected?.stationSilver ?? 0
  const stationSilver = baseStationSilver * (usageFee / 1000) * craftQty
  const grandTotal = matsTotal + stationSilver

  const fetchMarketPrices = async () => {
    if (!selected) return
    const ids = [...new Set(rows.map((r) => r.uniqueName).filter(Boolean))]
    if (ids.length === 0) return
    setShowPriceFetchFeedback(true)
    setPriceFetchStatus('loading')
    setPriceFetchMsg('Fetching prices…')
    try {
      const prices = await fetchPricesForItems(region, ids)
      setUnitPrices((prev) => {
        const next = { ...prev }
        for (const [id, silver] of Object.entries(prices)) {
          if (silver > 0) next[id] = silver
        }
        saveStoredPrices(next)
        return next
      })
      setPriceFetchStatus('ok')
      setPriceFetchMsg(`Updated ${Object.values(prices).filter((n) => n > 0).length} prices`)
    } catch (e) {
      setPriceFetchStatus('err')
      setPriceFetchMsg(e instanceof Error ? e.message : 'Fetch failed')
    }
  }

  useEffect(() => {
    setShowPriceFetchFeedback(false)
    setPriceFetchStatus('idle')
    setPriceFetchMsg('')
  }, [selectedId])

  useEffect(() => {
    saveStoredSetup({
      usageFee,
      rrr,
    })
  }, [usageFee, rrr])

  if (loadError) {
    return (
      <div className="planner">
        <div className="card-scroll card-scroll--solo">
          <div className="panel error">
            <p>Could not load recipe data: {loadError}</p>
            <p className="hint">
              Run <code className="inline-code">npm run parse-items</code> and ensure{' '}
              <code className="inline-code">public/data/</code> contains{' '}
              <code className="inline-code">weapons_recipes.json</code>,{' '}
              <code className="inline-code">head_recipes.json</code>,{' '}
              <code className="inline-code">chest_recipes.json</code>, and{' '}
              <code className="inline-code">boots_recipes.json</code>,{' '}
              <code className="inline-code">refining_cloth_recipes.json</code>,{' '}
              <code className="inline-code">refining_leather_recipes.json</code>,{' '}
              <code className="inline-code">refining_metal_bars_recipes.json</code>,{' '}
              <code className="inline-code">refining_stone_block_recipes.json</code>,{' '}
              <code className="inline-code">refining_planks_recipes.json</code>, and{' '}
              <code className="inline-code">brewing_heal_recipes.json</code>,{' '}
              <code className="inline-code">brewing_energy_recipes.json</code>,{' '}
              <code className="inline-code">brewing_gigantify_recipes.json</code>,{' '}
              <code className="inline-code">brewing_resistance_recipes.json</code>,{' '}
              <code className="inline-code">brewing_sticky_recipes.json</code>,{' '}
              <code className="inline-code">brewing_poison_recipes.json</code>,{' '}
              <code className="inline-code">brewing_invisibility_recipes.json</code>,{' '}
              <code className="inline-code">brewing_calming_recipes.json</code>,{' '}
              <code className="inline-code">brewing_cleansing_recipes.json</code>,{' '}
              <code className="inline-code">brewing_acid_recipes.json</code>,{' '}
              <code className="inline-code">brewing_berserk_recipes.json</code>,{' '}
              <code className="inline-code">brewing_hellfire_recipes.json</code>,{' '}
              <code className="inline-code">brewing_gathering_recipes.json</code>,{' '}
              <code className="inline-code">brewing_tornado_recipes.json</code>,{' '}
              <code className="inline-code">brewing_focus_recipes.json</code>, and{' '}
              <code className="inline-code">item_names_en.json</code> (English display names).
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!payload) {
    return <div className="planner" aria-hidden />
  }

  return (
    <div className="planner">
      <div className="workspace">
        <section className="panel panel--armory">
          <h2 className="panel-title">{ui.panelTitle}</h2>

          {!isBrewingKind(kind) ? (
            <>
              <div className="armory-filters">
                <div
                  className="filter-strip"
                  role="group"
                  aria-label="Item tier"
                  title="Tap the active tier again to show all tiers."
                >
                  <span className="filter-strip__label">Tier</span>
                  <div className="chip-row">
                    {TIER_VALUES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`chip chip--tier${tierFilter === t ? ' is-active' : ''}`}
                        aria-pressed={tierFilter === t}
                        onClick={() => setTierFilter((cur) => (cur === t ? null : t))}
                      >
                        T{t}
                      </button>
                    ))}
                  </div>
                </div>

                {supportsPreviewEnchant && tierFilter != null && tierFilter >= 4 ? (
                  <div
                    className="filter-strip filter-strip--enchant"
                    role="group"
                    aria-label="Enchantment"
                    title="Enchant only updates list icons; recipe data is still the flat item."
                  >
                    <span className="filter-strip__label">Enchant</span>
                    <div className="chip-row">
                      {ENCHANT_DISPLAY.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`chip chip--enchant${listEnchantView === n ? ' is-active' : ''}`}
                          aria-pressed={listEnchantView === n}
                          onClick={() => setListEnchantView(n)}
                        >
                          {tierFilter}.{n}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <p className="armory-legend">
                Tap the active tier again to clear · T4+ enchant only affects icons, not mat costs.
              </p>
            </>
          ) : null}

          <div className="search-block">
            <div className="search-wrap">
              <span className="search-icon" aria-hidden>
                {ui.searchIconSrc ? (
                  <img
                    src={ui.searchIconSrc}
                    alt=""
                    className="search-icon__img"
                    loading="lazy"
                    decoding="async"
                  />
                ) : ui.searchIconItemId ? (
                  <ItemIcon
                    uniqueName={ui.searchIconItemId}
                    localFolder={isBrewingKind(kind) ? 'alchemist' : 'resources'}
                    size={18}
                    className="search-icon__item"
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  ui.searchIcon
                )}
              </span>
              <input
                type="search"
                className="search-input"
                placeholder={ui.searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                aria-label={ui.searchAria}
              />
              {query ? (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              ) : null}
            </div>
            <div className="search-meta">
              <span className="match-pill">
                {filtered.length}{' '}
                {filtered.length === 1 ? ui.itemSingular : ui.itemPlural}
              </span>
              <p className="search-hint">
                Filters stack
              </p>
            </div>
          </div>

          <div className="card-scroll card-scroll--weapons" role="region" aria-label={ui.listAria}>
            <div className="weapon-list" role="listbox">
              {filtered.length === 0 ? (
                <div className="list-empty">{ui.emptyList}</div>
              ) : (
                filtered.map((r) => {
                  const isSel = selectedId === r.uniqueName
                  return (
                  <button
                    key={r.uniqueName}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    className={`weapon-item${isSel ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(r.uniqueName)}
                  >
                    <ItemIcon
                      uniqueName={r.uniqueName}
                      enchantmentLevel={listIconEnchant}
                      localFolder={outputLocalFolder}
                      size={44}
                      className="item-icon--list"
                      alt=""
                      hoverLabel={summarizeItemHoverLabel(r.uniqueName, listIconEnchant, itemNames)}
                      loading={isSel ? 'eager' : 'lazy'}
                      fetchPriority={isSel ? 'high' : undefined}
                    />
                    <span className="weapon-item__name">
                      {formatItemDisplayName(r.uniqueName, itemNames)}
                    </span>
                    {r.tier != null ? <span className="weapon-item__tier">T{r.tier}</span> : null}
                  </button>
                  )
                })
              )}
            </div>
          </div>
        </section>

        <div className="workspace-detail">
          {selected ? (
            <div className="workspace-detail-stack">
          <div className={`selection-banner ${tierVibeClass(selected.tier)}`.trim()}>
            <ItemIcon
              uniqueName={selected.uniqueName}
              enchantmentLevel={listIconEnchant}
              localFolder={outputLocalFolder}
              size={72}
              className="item-icon--hero"
              alt=""
              hoverLabel={summarizeItemHoverLabel(selected.uniqueName, listIconEnchant, itemNames)}
              loading="eager"
              fetchPriority="high"
            />
            <div className="selection-banner__text">
              <div className="selection-banner__label">{ui.selectionLabel}</div>
              <div className="selection-banner__name">
                {isRefiningSection
                  ? `${tierEnchantPrefix(selected.uniqueName)} ${formatItemDisplayName(
                      selected.uniqueName,
                      itemNames
                    )}`.trim()
                  : formatItemDisplayName(selected.uniqueName, itemNames)}
              </div>
              {supportsPreviewEnchant && tierFilter != null && tierFilter >= 4 && listEnchantView > 0 ? (
                <div className="selection-banner__enchant">
                  Preview {tierFilter}.{listEnchantView} icon
                </div>
              ) : null}
              {isBrewingKind(kind) && selectedBrewingTiers.length > 1 ? (
                <div className="selection-tier-variants">
                  <span className="selection-tier-variants__label">All tiers</span>
                  <div className="chip-row">
                    {selectedBrewingTiers.map((r) => (
                      <button
                        key={r.uniqueName}
                        type="button"
                        className={`chip chip--tier${selectedId === r.uniqueName ? ' is-active' : ''}`}
                        aria-pressed={selectedId === r.uniqueName}
                        onClick={() => setSelectedId(r.uniqueName)}
                      >
                        T{r.tier ?? '?'}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <section className="panel panel--resources">
            <div className="row spread">
              <h2>Resources</h2>
              <div className="market-controls-wrap">
                <div className="row gap market-controls">
                  <label className="field inline market-field market-field--qty">
                    <span className="muted">Craft Qty</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className="input input--market input--qty"
                      value={craftQty}
                      onChange={(e) => {
                        const next = Number(e.target.value || 1)
                        setCraftQty(Math.max(1, Math.floor(Number.isFinite(next) ? next : 1)))
                      }}
                    />
                  </label>
                  <label className="field inline market-field">
                    <span className="muted">Market</span>
                    <select
                      className="input input--market"
                      value={region}
                      onChange={(e) => setRegion(e.target.value as AodpRegion)}
                    >
                      <option value="asia">Asia</option>
                      <option value="europe">Europe</option>
                      <option value="americas">Americas</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn secondary btn--fetch"
                    disabled={priceFetchStatus === 'loading'}
                    onClick={() => void fetchMarketPrices()}
                  >
                    {priceFetchStatus === 'loading' ? 'Fetching…' : 'Fetch prices'}
                  </button>
                </div>
                <div className="market-feedback" aria-live="polite">
                  {showPriceFetchFeedback && priceFetchMsg ? (
                    <p
                      className={`market-feedback__msg${
                        priceFetchStatus === 'err'
                          ? ' is-error'
                          : priceFetchStatus === 'ok'
                            ? ' is-success'
                            : ''
                      }`}
                    >
                      {priceFetchMsg}
                    </p>
                  ) : (
                    <p className="market-feedback__msg is-idle" aria-hidden />
                  )}
                </div>
              </div>
            </div>

            <div className="card-scroll card-scroll--table" role="region" aria-label="Resource costs">
            <div className="table-wrap">
              <table className="cost-table">
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Qty</th>
                    <th>Owned</th>
                    <th>Need</th>
                    <th>Price</th>
                    <th>Silver</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.uniqueName}-${r.enchantmentLevel ?? 0}`}>
                      <ItemCell
                        uniqueName={r.uniqueName}
                        itemNames={itemNames}
                      />
                      <td>{r.requiredQty}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="input num"
                          value={owned[r.uniqueName] ?? ''}
                          placeholder="0"
                          onChange={(e) =>
                            setOwnedQty(
                              r.uniqueName,
                              e.target.value === '' ? 0 : Number(e.target.value)
                            )
                          }
                        />
                      </td>
                      <td>{r.needBuy}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="input num"
                          value={r.unit || ''}
                          placeholder="0"
                          onChange={(e) =>
                            setUnitPrice(
                              r.uniqueName,
                              e.target.value === '' ? 0 : Number(e.target.value)
                            )
                          }
                        />
                      </td>
                      <td className="num">{formatSilver(r.line)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
            <div className="resources-summary">
              <div className="resources-summary__row">
                <span>Craft Quantity:</span>
                <strong>{craftQty}</strong>
              </div>
              <div className="resources-summary__row">
                <span>Station Usage Fee:</span>
                <strong>{formatSilver(stationSilver)}</strong>
              </div>
              <div className="resources-summary__row resources-summary__row--grand">
                <span>Total Cost ( Silver ):</span>
                <strong>{formatSilver(grandTotal)}</strong>
              </div>
            </div>
            <div className="resources-summary__actions">
              <button
                type="button"
                className="btn secondary btn--setup-inline"
                onClick={() => setShowCraftSetup(true)}
              >
                Craft Setup
              </button>
            </div>
          </section>
            </div>
          ) : (
            <section className="panel panel--pick">
              <p>{ui.pickPrompt}</p>
            </section>
          )}
        </div>
      </div>

      {showCraftSetup ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            shouldCloseCraftSetupOnClickRef.current = e.target === e.currentTarget
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && shouldCloseCraftSetupOnClickRef.current) {
              setShowCraftSetup(false)
            }
          }}
        >
          <section className="modal-card" role="dialog" aria-modal="true" aria-label="Craft Settings">
            <div className="modal-card__head">
              <h3>Craft Settings</h3>
              <button
                type="button"
                className="modal-close"
                aria-label="Close craft settings"
                onClick={() => setShowCraftSetup(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-form setup-form-shell" aria-live="polite">
              <p className="setup-form__intro">Craft setup values for fee and return assumptions.</p>
              <label className="field">
                <span>Usage Fee</span>
                <input
                  type="number"
                  min={0}
                  required
                  className="input"
                  value={usageFee}
                  onChange={(e) => setUsageFee(Math.max(0, Number(e.target.value || 0)))}
                />
                <small className="setup-field__hint">Per 100 nutrition (default: 1000).</small>
              </label>

              <label className="field">
                <span>RRR (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  className="input"
                  value={rrr}
                  onChange={(e) => setRrr(Math.max(0, Math.min(100, Number(e.target.value || 0))))}
                />
                <small className="setup-field__hint">Expected return rate, from 0 to 100.</small>
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowCraftSetup(false)}>
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
