import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fetchPricesForItems, type PriceCity } from './aodp'
import {
  formatItemDisplayName,
  itemMatchesSearchQuery,
  summarizeItemHoverLabel,
  type ItemNameMap,
} from './formatItemName'
import { ItemIcon } from './ItemIcon'
import type { LocalIconFolder } from './itemIconUrl'
import type { AodpRegion, CraftPlannerKind, CraftRecipe, RecipesPayload } from './types'

const LS_PRICES = 'albion-weapon-craft:unitPrices'
const LS_CRAFT_SETUP = 'albion-weapon-craft:setup'
const LS_PRICE_CITY = 'albion-weapon-craft:priceCity'
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
  offhands: '/data/offhands_recipes.json',
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
  cooking_stews: '/data/cooking_stews_recipes.json',
  cooking_soups: '/data/cooking_soups_recipes.json',
  cooking_salads: '/data/cooking_salads_recipes.json',
  cooking_sandwiches: '/data/cooking_sandwiches_recipes.json',
  cooking_pies: '/data/cooking_pies_recipes.json',
  cooking_omelettes: '/data/cooking_omelettes_recipes.json',
  cooking_roasts: '/data/cooking_roasts_recipes.json',
  cooking_grilledfish: '/data/cooking_grilledfish_recipes.json',
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
  })().catch((error) => {
    delete recipePromiseCache[kind]
    throw error
  })

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
  })().catch((error) => {
    namesPromiseCache = null
    throw error
  })

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
  searchIconItemId?: string
  searchIconEnchantLevel?: number
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
    searchIconItemId: 'T8_MAIN_SWORD',
    searchIconEnchantLevel: 4,
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
    searchIconItemId: 'T8_HEAD_PLATE_SET1',
    searchIconEnchantLevel: 4,
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
    searchIconItemId: 'T8_ARMOR_PLATE_SET1',
    searchIconEnchantLevel: 4,
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
    searchIconItemId: 'T8_SHOES_PLATE_SET1',
    searchIconEnchantLevel: 4,
    emptyList: 'No boots match that search.',
    pickPrompt: 'Choose boots from the list to view resources and silver totals.',
    selectionLabel: 'Selected boots',
  },
  offhands: {
    panelTitle: 'Off-hand',
    itemSingular: 'item',
    itemPlural: 'items',
    searchPlaceholder: 'Search off-hands…',
    searchAria: 'Filter off-hands',
    listAria: 'Off-hand list',
    searchIcon: '🛡',
    searchIconItemId: 'T8_OFF_SHIELD',
    searchIconEnchantLevel: 4,
    emptyList: 'No off-hands match that search.',
    pickPrompt: 'Choose an off-hand from the list to view resources and silver totals.',
    selectionLabel: 'Selected off-hand',
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
  cooking_stews: {
    panelTitle: 'Cooking · Stews',
    itemSingular: 'meal',
    itemPlural: 'meals',
    searchPlaceholder: 'Search stews…',
    searchAria: 'Filter stews',
    listAria: 'Stew list',
    searchIcon: '🍲',
    searchIconItemId: 'T8_MEAL_STEW',
    emptyList: 'No stew recipe matches that search.',
    pickPrompt: 'Choose a stew to view ingredients and silver totals.',
    selectionLabel: 'Selected stew',
  },
  cooking_soups: {
    panelTitle: 'Cooking · Soups',
    itemSingular: 'meal',
    itemPlural: 'meals',
    searchPlaceholder: 'Search soups…',
    searchAria: 'Filter soups',
    listAria: 'Soup list',
    searchIcon: '🥣',
    searchIconItemId: 'T5_MEAL_SOUP',
    emptyList: 'No soup recipe matches that search.',
    pickPrompt: 'Choose a soup to view ingredients and silver totals.',
    selectionLabel: 'Selected soup',
  },
  cooking_salads: {
    panelTitle: 'Cooking · Salads',
    itemSingular: 'meal',
    itemPlural: 'meals',
    searchPlaceholder: 'Search salads…',
    searchAria: 'Filter salads',
    listAria: 'Salad list',
    searchIcon: '🥗',
    searchIconItemId: 'T6_MEAL_SALAD',
    emptyList: 'No salad recipe matches that search.',
    pickPrompt: 'Choose a salad to view ingredients and silver totals.',
    selectionLabel: 'Selected salad',
  },
  cooking_sandwiches: {
    panelTitle: 'Cooking · Sandwiches',
    itemSingular: 'meal',
    itemPlural: 'meals',
    searchPlaceholder: 'Search sandwiches…',
    searchAria: 'Filter sandwiches',
    listAria: 'Sandwich list',
    searchIcon: '🥪',
    searchIconItemId: 'T8_MEAL_SANDWICH',
    emptyList: 'No sandwich recipe matches that search.',
    pickPrompt: 'Choose a sandwich to view ingredients and silver totals.',
    selectionLabel: 'Selected sandwich',
  },
  cooking_pies: {
    panelTitle: 'Cooking · Pies',
    itemSingular: 'meal',
    itemPlural: 'meals',
    searchPlaceholder: 'Search pies…',
    searchAria: 'Filter pies',
    listAria: 'Pie list',
    searchIcon: '🥧',
    searchIconItemId: 'T7_MEAL_PIE',
    emptyList: 'No pie recipe matches that search.',
    pickPrompt: 'Choose a pie to view ingredients and silver totals.',
    selectionLabel: 'Selected pie',
  },
  cooking_omelettes: {
    panelTitle: 'Cooking · Omelettes',
    itemSingular: 'meal',
    itemPlural: 'meals',
    searchPlaceholder: 'Search omelettes…',
    searchAria: 'Filter omelettes',
    listAria: 'Omelette list',
    searchIcon: '🍳',
    searchIconItemId: 'T7_MEAL_OMELETTE',
    emptyList: 'No omelette recipe matches that search.',
    pickPrompt: 'Choose an omelette to view ingredients and silver totals.',
    selectionLabel: 'Selected omelette',
  },
  cooking_roasts: {
    panelTitle: 'Cooking · Roasts',
    itemSingular: 'meal',
    itemPlural: 'meals',
    searchPlaceholder: 'Search roasts…',
    searchAria: 'Filter roasts',
    listAria: 'Roast list',
    searchIcon: '🍖',
    searchIconItemId: 'T7_MEAL_ROAST',
    emptyList: 'No roast recipe matches that search.',
    pickPrompt: 'Choose a roast to view ingredients and silver totals.',
    selectionLabel: 'Selected roast',
  },
  cooking_grilledfish: {
    panelTitle: 'Cooking · Grilled Fish',
    itemSingular: 'meal',
    itemPlural: 'meals',
    searchPlaceholder: 'Search grilled fish…',
    searchAria: 'Filter grilled fish',
    listAria: 'Grilled fish list',
    searchIcon: '🐟',
    searchIconItemId: 'T1_MEAL_GRILLEDFISH',
    emptyList: 'No grilled fish recipe matches that search.',
    pickPrompt: 'Choose a grilled fish meal to view ingredients and silver totals.',
    selectionLabel: 'Selected grilled fish',
  },
}

function isArmorCraftKind(
  kind: CraftPlannerKind
): kind is 'weapons' | 'offhands' | 'head' | 'chest' | 'boots' {
  return (
    kind === 'weapons' ||
    kind === 'offhands' ||
    kind === 'head' ||
    kind === 'chest' ||
    kind === 'boots'
  )
}

function isBrewingKind(kind: CraftPlannerKind): kind is Extract<CraftPlannerKind, `brewing_${string}`> {
  return kind.startsWith('brewing_')
}

function isCookingKind(kind: CraftPlannerKind): kind is Extract<CraftPlannerKind, `cooking_${string}`> {
  return kind.startsWith('cooking_')
}

function outputPerRecipeForKind(kind: CraftPlannerKind): number {
  if (isCookingKind(kind)) return 10
  if (isBrewingKind(kind)) return 5
  if (kind.startsWith('refining_')) return 1
  return 1
}

/** How many station "craft" operations `craftQty` represents (recipe rows are per operation). */
function craftOperationCount(kind: CraftPlannerKind, craftQty: number): number {
  if (!Number.isFinite(craftQty) || craftQty <= 0) return 0
  const per = outputPerRecipeForKind(kind)
  if (per <= 1) return Math.floor(craftQty)
  return Math.floor(craftQty / per)
}

function defaultCraftQtyForKind(kind: CraftPlannerKind): number {
  return outputPerRecipeForKind(kind)
}

function itemTierFamilyKey(uniqueName: string): string {
  return uniqueName
    .replace(/^T\d+_/, '')
    .replace(/__ALT\d+$/i, '')
    .replace(/_LEVEL\d+$/, '')
}

function cookingTierFamilyKey(uniqueName: string): string {
  return uniqueName.replace(/^T\d+_/, '').replace(/_LEVEL\d+$/, '')
}

function tierFromUniqueName(uniqueName: string): number | null {
  const m = uniqueName.match(/^T(\d+)_/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

/** Output enchant (.1–.4) from recipe id; strips `__ALT2` so `T4_CLOTH_LEVEL1__ALT2` → 1. */
function refiningEnchantFromUniqueName(uniqueName: string): number {
  const base = uniqueName.replace(/__ALT\d+$/i, '')
  const m = base.match(/_LEVEL([1-4])$/)
  if (!m) return 0
  const n = Number(m[1])
  return Number.isFinite(n) ? n : 0
}

/** Same refining output family: `T4_CLOTH_LEVEL1__ALT2` → `T4_CLOTH_LEVEL1`. */
function refiningVariantGroupKey(uniqueName: string): string {
  return uniqueName.replace(/__ALT\d+$/i, '')
}

function refiningAltOrdinal(uniqueName: string): number {
  const m = uniqueName.match(/__ALT(\d+)$/i)
  return m ? Number(m[1]) : 0
}

function titleCaseWords(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

function refiningVariantChipLabel(recipe: CraftRecipe, names: ItemNameMap | null): string {
  const tag = recipe.recipeVariantTag?.trim()
  if (tag) {
    const basalt = tag.match(/^\.([1-4])\s+basalt$/i)
    if (basalt) {
      const tier = tierFromUniqueName(recipe.uniqueName)
      const base = formatItemDisplayName(recipe.uniqueName, names).replace(/\s+BLOCK$/i, '').trim()
      const named = titleCaseWords(base)
      if (tier != null) return `${tier}.${basalt[1]} ${named}`
      return `.${basalt[1]} ${named}`
    }
    return tag.toUpperCase()
  }
  return 'Standard'
}

function loadStoredPrices(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_PRICES)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(o)) {
      const n = Number(v)
      if (Number.isFinite(n) && n >= 0) out[k] = n
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
const MAX_RESOURCE_ROWS = 7
const MAX_CRAFT_QTY = 9999
const MAX_RESOURCE_QTY = 99999999
const MAX_UNIT_PRICE = 9999999999
const MAX_USAGE_FEE = 1000000
const MAX_RRR = 100
const PRICE_CITY_OPTIONS: ReadonlyArray<{ value: PriceCity; label: string }> = [
  { value: 'lowest', label: 'Lowest Price' },
  { value: 'Bridgewatch', label: 'Bridgewatch' },
  { value: 'Martlock', label: 'Martlock' },
  { value: 'Thetford', label: 'Thetford' },
  { value: 'Fort Sterling', label: 'Fort Sterling' },
  { value: 'Lymhurst', label: 'Lymhurst' },
  { value: 'Caerleon', label: 'Caerleon' },
  { value: 'Brecilien', label: 'Brecilien' },
  { value: 'Black Market', label: 'Black Market' },
]

function loadStoredPriceCity(): PriceCity {
  const raw = localStorage.getItem(LS_PRICE_CITY)
  if (!raw) return 'lowest'
  if (PRICE_CITY_OPTIONS.some((c) => c.value === raw)) {
    return raw as PriceCity
  }
  return 'lowest'
}

function saveStoredPriceCity(city: PriceCity) {
  localStorage.setItem(LS_PRICE_CITY, city)
}

function clampCraftQtyWithMin(n: number, min: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(MAX_CRAFT_QTY, Math.floor(n)))
}

function clampNonNegativeInt(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(max, Math.floor(n)))
}

function clampNonNegativeFloat(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(max, n))
}

/** Digits only for owned-material text fields (max length matches MAX_RESOURCE_QTY). */
/** Matches `shopSub1` on weapon recipes from the parser (display order like in-game). */
const WEAPON_CATEGORY_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Bow', value: 'bow' },
  { label: 'Crossbow', value: 'crossbow' },
  { label: 'Axe', value: 'axe' },
  { label: 'Dagger', value: 'dagger' },
  { label: 'Hammer', value: 'hammer' },
  { label: 'War Gloves', value: 'knuckles' },
  { label: 'Mace', value: 'mace' },
  { label: 'Quarterstaff', value: 'quarterstaff' },
  { label: 'Spear', value: 'spear' },
  { label: 'Sword', value: 'sword' },
  { label: 'Arcane Staff', value: 'arcanestaff' },
  { label: 'Cursed Staff', value: 'cursestaff' },
  { label: 'Fire Staff', value: 'firestaff' },
  { label: 'Frost Staff', value: 'froststaff' },
  { label: 'Holy Staff', value: 'holystaff' },
  { label: 'Nature Staff', value: 'naturestaff' },
  { label: 'Shapeshifter Staff', value: 'shapeshifterstaff' },
]

/** Matches `shopSub1` on off-hand recipes (shield / book / torch). */
const OFFHAND_CATEGORY_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Shield', value: 'shieldtype' },
  { label: 'Book', value: 'booktype' },
  { label: 'Torch', value: 'torchtype' },
]

const HEAD_CATEGORY_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Cloth', value: 'cloth_helmet' },
  { label: 'Leather', value: 'leather_helmet' },
  { label: 'Plate', value: 'plate_helmet' },
]

const CHEST_CATEGORY_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Cloth', value: 'cloth_armor' },
  { label: 'Leather', value: 'leather_armor' },
  { label: 'Plate', value: 'plate_armor' },
]

const BOOTS_CATEGORY_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Cloth', value: 'cloth_shoes' },
  { label: 'Leather', value: 'leather_shoes' },
  { label: 'Plate', value: 'plate_shoes' },
]

function shopSub1OptionsForKind(kind: CraftPlannerKind): ReadonlyArray<{ label: string; value: string }> | null {
  if (kind === 'weapons') return WEAPON_CATEGORY_OPTIONS
  if (kind === 'offhands') return OFFHAND_CATEGORY_OPTIONS
  if (kind === 'head') return HEAD_CATEGORY_OPTIONS
  if (kind === 'chest') return CHEST_CATEGORY_OPTIONS
  if (kind === 'boots') return BOOTS_CATEGORY_OPTIONS
  return null
}

function shopSub1FilterAriaLabel(kind: CraftPlannerKind): string {
  if (kind === 'weapons') return 'Filter by weapon type'
  if (kind === 'offhands') return 'Filter by off-hand type'
  if (kind === 'head') return 'Filter by head armor type'
  if (kind === 'chest') return 'Filter by chest armor type'
  if (kind === 'boots') return 'Filter by foot armor type'
  return 'Filter by category'
}

function withRefinedEnchant(uniqueName: string, enchant: number): string {
  if (enchant < 1 || enchant > 4) return uniqueName
  const baseId = uniqueName.replace(/__ALT\d+$/i, '')
  const m = baseId.match(
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

function enchantVibeClass(enchant?: number): string {
  if (enchant == null) return ''
  if (enchant < 1 || enchant > 4) return ''
  return `selection-banner--ench${enchant}`
}

function loadStoredSetup(): CraftSetupState {
  try {
    const raw = localStorage.getItem(LS_CRAFT_SETUP)
    if (!raw) return DEFAULT_CRAFT_SETUP
    const parsed = JSON.parse(raw) as Partial<CraftSetupState>
    return {
      usageFee:
        typeof parsed.usageFee === 'number' && Number.isFinite(parsed.usageFee)
          ? clampNonNegativeInt(parsed.usageFee, MAX_USAGE_FEE)
          : DEFAULT_CRAFT_SETUP.usageFee,
      rrr:
        typeof parsed.rrr === 'number' && Number.isFinite(parsed.rrr)
          ? clampNonNegativeFloat(parsed.rrr, MAX_RRR)
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
  const id = uniqueName.replace(/__ALT\d+$/i, '')
  const tierMatch = id.match(/^T(\d+)_/)
  if (!tierMatch) return ''
  const enchantMatch = id.match(/_LEVEL([1-4])$/)
  const enchant = enchantMatch ? Number(enchantMatch[1]) : 0
  return `${tierMatch[1]}.${enchant}`
}

/** List / banner label: base item name plus refining path tag when present. */
function recipeRowDisplayLabel(recipe: CraftRecipe, names: ItemNameMap | null): string {
  const alt = recipe.uniqueName.match(/__ALT(\d+)$/i)
  const stripped = alt ? recipe.uniqueName.replace(/__ALT\d+$/i, '') : recipe.uniqueName
  const base = formatItemDisplayName(stripped, names)
  const tag = recipe.recipeVariantTag?.trim()
  if (tag) return `${base} · ${tag.toUpperCase()}`
  if (alt) return `${base} · RECIPE ${alt[1]}`
  return formatItemDisplayName(recipe.uniqueName, names)
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
  const shopSub1Options = shopSub1OptionsForKind(kind)
  const maxEnchantDisplay = isBrewingKind(kind) || isCookingKind(kind) ? 3 : 4
  const enchantDisplayValues = ENCHANT_DISPLAY.filter((n) => n <= maxEnchantDisplay)
  const isRefiningSection = kind.startsWith('refining_')
  const supportsPreviewEnchantNonRefining =
    isArmorCraftKind(kind) || isCookingKind(kind) || isBrewingKind(kind)
  const enchantPreviewMinTier = isCookingKind(kind) || isBrewingKind(kind) ? 3 : 4
  const outputLocalFolder: LocalIconFolder = isArmorCraftKind(kind)
    ? kind
    : isBrewingKind(kind)
      ? 'alchemist'
      : isCookingKind(kind)
        ? 'cooking'
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
  const [showPriceCityPicker, setShowPriceCityPicker] = useState(false)
  const [priceCity, setPriceCity] = useState<PriceCity>(() => loadStoredPriceCity())
  const [showCraftSetup, setShowCraftSetup] = useState(false)
  const shouldCloseCraftSetupOnClickRef = useRef(false)
  const priceCityPickerRef = useRef<HTMLDivElement | null>(null)
  const marketFetchSeqRef = useRef(0)
  const marketFetchAbortRef = useRef<AbortController | null>(null)
  const [craftQty, setCraftQty] = useState(() => defaultCraftQtyForKind(kind))
  const [usageFee, setUsageFee] = useState(initialSetup.usageFee)
  const [rrr, setRrr] = useState(initialSetup.rrr)
  /** `null` = all tiers. Toggle same tier again to clear. */
  const [tierFilter, setTierFilter] = useState<number | null>(null)

  /** List icon enchant (render @N). Used when `tierFilter >= 4`. */
  const [listEnchantView, setListEnchantView] = useState(0)
  /** Refining: index into alternate paths (Vineheart, basalt, …) for the current list row + enchant. */
  const [refiningVariantIndex, setRefiningVariantIndex] = useState(0)
  /** Weapons & off-hands: filter by `shopSub1` (empty = all types). */
  const [shopSub1Filter, setShopSub1Filter] = useState('')

  useEffect(() => {
    if (listEnchantView > maxEnchantDisplay) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setListEnchantView(maxEnchantDisplay)
    }
  }, [listEnchantView, maxEnchantDisplay])

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
  const canUseRefiningEnchant = useMemo(
    () => isRefiningSection && recipes.some((r) => /_LEVEL[1-4]$/.test(r.uniqueName)),
    [isRefiningSection, recipes]
  )
  const supportsPreviewEnchant = supportsPreviewEnchantNonRefining || canUseRefiningEnchant
  const availableTiers = useMemo(() => {
    const set = new Set<number>()
    for (const r of recipes) {
      if (typeof r.tier === 'number') set.add(r.tier)
    }
    const tiers = [...set].sort((a, b) => a - b).filter((t) => TIER_VALUES.includes(t as (typeof TIER_VALUES)[number]))
    if (isRefiningSection) return tiers.filter((t) => t !== 1)
    return tiers.length > 0 ? tiers : [...TIER_VALUES]
  }, [recipes, isRefiningSection])

  useEffect(() => {
    if (tierFilter != null && !availableTiers.includes(tierFilter)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTierFilter(null)
    }
  }, [availableTiers, tierFilter])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return recipes.filter((r) => {
      if (!isBrewingKind(kind) && tierFilter != null && r.tier !== tierFilter) return false
      if (shopSub1Options && shopSub1Filter) {
        if ((r.shopSub1 ?? '').toLowerCase() !== shopSub1Filter) return false
      }
      return itemMatchesSearchQuery(r.uniqueName, q, itemNames)
    })
  }, [recipes, query, tierFilter, itemNames, shopSub1Options, shopSub1Filter, kind])

  /** Refining list: unenchanted output only (.0); paths + enchant from banner. */
  const listRows = useMemo(() => {
    if (!isRefiningSection) return filtered
    return filtered.filter(
      (r) =>
        !/__ALT\d+$/i.test(r.uniqueName) && refiningEnchantFromUniqueName(r.uniqueName) === 0
    )
  }, [filtered, isRefiningSection])

  const refiningVariants = useMemo(() => {
    if (!isRefiningSection || selectedId == null) return []
    const q = query.trim()
    const family = itemTierFamilyKey(selectedId)
    const selectedOutputTier = tierFromUniqueName(selectedId)
    const out = recipes.filter((r) => {
      if (itemTierFamilyKey(r.uniqueName) !== family) return false
      const rt = r.tier ?? tierFromUniqueName(r.uniqueName)
      if (selectedOutputTier != null && rt !== selectedOutputTier) return false
      if (tierFilter != null && r.tier !== tierFilter) return false
      if (canUseRefiningEnchant && selectedOutputTier != null) {
        if (selectedOutputTier >= enchantPreviewMinTier) {
          if (refiningEnchantFromUniqueName(r.uniqueName) !== listEnchantView) return false
        } else if (refiningEnchantFromUniqueName(r.uniqueName) !== 0) {
          return false
        }
      }
      return itemMatchesSearchQuery(r.uniqueName, q, itemNames)
    })
    return out.sort((a, b) => {
      const da = refiningAltOrdinal(a.uniqueName)
      const db = refiningAltOrdinal(b.uniqueName)
      if (da !== db) return da - db
      return a.uniqueName.localeCompare(b.uniqueName)
    })
  }, [
    isRefiningSection,
    selectedId,
    recipes,
    tierFilter,
    listEnchantView,
    canUseRefiningEnchant,
    enchantPreviewMinTier,
    query,
    itemNames,
  ])

  const listIconEnchant =
    supportsPreviewEnchant &&
    tierFilter != null &&
    tierFilter >= enchantPreviewMinTier &&
    listEnchantView > 0
      ? listEnchantView
      : undefined

  const selected = useMemo(() => {
    if (!selectedId) return null
    if (isRefiningSection) {
      if (refiningVariants.length === 0) return null
      const i = Math.min(Math.max(0, refiningVariantIndex), refiningVariants.length - 1)
      return refiningVariants[i] ?? null
    }
    return recipes.find((r) => r.uniqueName === selectedId) ?? null
  }, [selectedId, isRefiningSection, refiningVariantIndex, refiningVariants, recipes])

  const selectedListRowRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefiningVariantIndex(0)
  }, [listEnchantView, tierFilter, kind])

  useEffect(() => {
    if (!isRefiningSection) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefiningVariantIndex((i) => {
      if (refiningVariants.length === 0) return 0
      return Math.min(i, refiningVariants.length - 1)
    })
  }, [isRefiningSection, refiningVariants])

  useEffect(() => {
    if (selectedId == null) return
    if (listRows.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(null)
      return
    }
    if (!listRows.some((r) => r.uniqueName === selectedId)) {
      setSelectedId(listRows[0].uniqueName)
      setRefiningVariantIndex(0)
    }
  }, [listRows, selectedId])

  useLayoutEffect(() => {
    if (!selectedId) return
    selectedListRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId, kind, query, tierFilter, listEnchantView])

  const selectedTierValue = useMemo(() => {
    if (!selected) return null
    if (typeof selected.tier === 'number') return selected.tier
    return tierFromUniqueName(selected.uniqueName)
  }, [selected])

  const selectedTierVariants = useMemo(() => {
    if (!selected) return []
    const family = isBrewingKind(kind)
      ? potionTierFamilyKey(selected.uniqueName)
      : isCookingKind(kind)
        ? cookingTierFamilyKey(selected.uniqueName)
        : itemTierFamilyKey(selected.uniqueName)
    return recipes
      .filter((r) => {
        if (isRefiningSection && /__ALT\d+$/i.test(r.uniqueName)) return false
        const rowFamily = isBrewingKind(kind)
          ? potionTierFamilyKey(r.uniqueName)
          : isCookingKind(kind)
            ? cookingTierFamilyKey(r.uniqueName)
            : itemTierFamilyKey(r.uniqueName)
        return rowFamily === family
      })
      .sort((a, b) => {
        const ta = a.tier ?? tierFromUniqueName(a.uniqueName) ?? 0
        const tb = b.tier ?? tierFromUniqueName(b.uniqueName) ?? 0
        if (ta !== tb) return ta - tb
        // Non-.1–.4 outputs first, then enchanted outputs (includes `__ALT` vineheart rows).
        const aBase = refiningEnchantFromUniqueName(a.uniqueName) > 0 ? 1 : 0
        const bBase = refiningEnchantFromUniqueName(b.uniqueName) > 0 ? 1 : 0
        return aBase - bBase
      })
      .reduce<typeof recipes>((acc, r) => {
        const t = r.tier ?? tierFromUniqueName(r.uniqueName) ?? -1
        if (t < 0) return acc
        if (!acc.some((x) => (x.tier ?? tierFromUniqueName(x.uniqueName) ?? -1) === t)) {
          acc.push(r)
        }
        return acc
      }, [])
  }, [kind, selected, recipes, isRefiningSection])
  const selectedRefiningFamily = useMemo(
    () => (isRefiningSection && selected ? itemTierFamilyKey(selected.uniqueName) : null),
    [isRefiningSection, selected]
  )
  const selectRecipe = useCallback(
    (recipe: CraftRecipe) => {
      const listKey = isRefiningSection ? refiningVariantGroupKey(recipe.uniqueName) : recipe.uniqueName
      setSelectedId(listKey)
      setRefiningVariantIndex(0)
      const nextTier = recipe.tier ?? tierFromUniqueName(recipe.uniqueName)
      if (!isBrewingKind(kind) && nextTier != null) {
        setTierFilter(nextTier)
      }
      if (canUseRefiningEnchant) {
        const nextEnchant = refiningEnchantFromUniqueName(recipe.uniqueName)
        if (nextTier != null && nextTier >= enchantPreviewMinTier) {
          setListEnchantView(nextEnchant)
        } else {
          setListEnchantView(0)
        }
      } else if (isRefiningSection) {
        setListEnchantView(0)
      }
    },
    [isRefiningSection, canUseRefiningEnchant, enchantPreviewMinTier, setRefiningVariantIndex, kind]
  )

  const recipeStorageKey = selected?.uniqueName ?? null

  const selectedDisplayUniqueName = useMemo(() => {
    if (!selected) return null
    if (!isRefiningSection || !canUseRefiningEnchant) return selected.uniqueName
    const enchant =
      selectedTierValue != null && selectedTierValue >= enchantPreviewMinTier && listEnchantView > 0
        ? listEnchantView
        : 0
    return withRefinedEnchant(selected.uniqueName, enchant)
  }, [selected, isRefiningSection, canUseRefiningEnchant, selectedTierValue, enchantPreviewMinTier, listEnchantView])
  const selectedPreviewEnchant = useMemo(() => {
    if (!selected || selectedTierValue == null || selectedTierValue < enchantPreviewMinTier) return 0
    const ench = Math.max(0, Math.min(maxEnchantDisplay, listEnchantView))
    return ench
  }, [selected, selectedTierValue, enchantPreviewMinTier, maxEnchantDisplay, listEnchantView])
  const selectedBannerClasses = useMemo(
    () =>
      `selection-banner ${tierVibeClass(selectedTierValue ?? undefined)} ${enchantVibeClass(selectedPreviewEnchant)}`.trim(),
    [selectedTierValue, selectedPreviewEnchant]
  )
  const selectedHeroIconClass = useMemo(
    () => `item-icon--hero ${enchantVibeClass(selectedPreviewEnchant)}`.trim(),
    [selectedPreviewEnchant]
  )

  const owned = useMemo(() => {
    if (!recipeStorageKey) return {}
    return ownedByRecipe[recipeStorageKey] ?? {}
  }, [recipeStorageKey, ownedByRecipe])

  const setUnitPrice = useCallback((id: string, value: number) => {
    setUnitPrices((prev) => {
      const safeValue = clampNonNegativeInt(value, MAX_UNIT_PRICE)
      const next = { ...prev, [id]: safeValue }
      saveStoredPrices(next)
      return next
    })
  }, [])

  const setOwnedQty = useCallback((resourceId: string, value: number) => {
    if (!recipeStorageKey) return
    const qty = clampNonNegativeInt(value, MAX_RESOURCE_QTY)
    setOwnedByRecipe((prev) => ({
      ...prev,
      [recipeStorageKey]: {
        ...(prev[recipeStorageKey] ?? {}),
        [resourceId]: qty,
      },
    }))
  }, [recipeStorageKey])

  const craftEnchant = useMemo(
    () =>
      supportsPreviewEnchant &&
      selectedTierValue != null &&
      selectedTierValue >= enchantPreviewMinTier &&
      listEnchantView > 0
        ? listEnchantView
        : 0,
    [supportsPreviewEnchant, selectedTierValue, enchantPreviewMinTier, listEnchantView]
  )

  const rows = useMemo(() => {
    if (!selected) return []
    const hasExplicitEnchantResources = selected.resources.some((r) => (r.enchantmentLevel ?? 0) > 0)
    const useExplicitEnchantOnly = kind === 'offhands' && hasExplicitEnchantResources

    // Refining: each list row is a fixed recipe (e.g. basalt path includes T4_ROCK_LEVEL2).
    // Do not strip mats by listEnchantView — that preview is for output icon / row filter only.
    const applicableResources = isRefiningSection
      ? selected.resources
      : selected.resources.filter((r) => {
          const level = r.enchantmentLevel ?? 0
          if (craftEnchant > 0) {
            // Some sections (off-hands) already include explicit .1-.4 mats in recipe data.
            // In that case, avoid also promoting base mats to enchanted IDs, which duplicates rows.
            if (useExplicitEnchantOnly) return level === craftEnchant
            return level === 0 || level === craftEnchant
          }
          return level === 0
        })

    const batches = craftOperationCount(kind, craftQty)
    return applicableResources.map((r) => {
      const resourceId = isRefiningSection
        ? withRefinedEnchant(r.uniqueName, r.enchantmentLevel ?? 0)
        : withRefinedEnchant(r.uniqueName, craftEnchant)
      const requiredQty = r.count * batches
      const needBuy = Math.max(0, requiredQty - (owned[resourceId] ?? 0))
      const unit = unitPrices[resourceId] ?? 0
      const line = needBuy * unit
      return { ...r, uniqueName: resourceId, requiredQty, needBuy, unit, line }
    })
  }, [
    selected,
    owned,
    unitPrices,
    craftEnchant,
    craftQty,
    isRefiningSection,
    kind,
  ])

  const displayRows = useMemo(() => {
    if (rows.length <= MAX_RESOURCE_ROWS) return rows
    if (craftEnchant <= 0) return rows.slice(0, MAX_RESOURCE_ROWS)

    const selected = new Set<string>()
    const picked: typeof rows = []
    const keyOf = (r: (typeof rows)[number]) => `${r.uniqueName}::${r.requiredQty}`

    // Keep enchant-specific rows visible first (e.g. Arcane Extract for .1/.2/.3 potions).
    for (const r of rows) {
      if ((r.enchantmentLevel ?? 0) !== craftEnchant) continue
      const key = keyOf(r)
      if (selected.has(key)) continue
      selected.add(key)
      picked.push(r)
      if (picked.length >= MAX_RESOURCE_ROWS) return picked
    }

    for (const r of rows) {
      const key = keyOf(r)
      if (selected.has(key)) continue
      selected.add(key)
      picked.push(r)
      if (picked.length >= MAX_RESOURCE_ROWS) break
    }

    return picked
  }, [rows, craftEnchant])

  useEffect(() => {
    // Reset section-local filters when switching to another craft section.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTierFilter(null)
    setListEnchantView(0)
    setSelectedId(null)
    setRefiningVariantIndex(0)
    setShopSub1Filter('')
    setCraftQty(defaultCraftQtyForKind(kind))
  }, [kind])

  const matsTotal = rows.reduce((s, r) => s + r.line, 0)
  const baseStationSilver = selected?.stationSilver ?? 0
  const stationOps = craftOperationCount(kind, craftQty)
  const stationSilver = baseStationSilver * (usageFee / 1000) * stationOps
  const grandTotal = matsTotal + stationSilver
  const craftQtyStep = outputPerRecipeForKind(kind)
  const craftQtyMin = craftQtyStep
  const fetchMarketPrices = async (city: PriceCity) => {
    if (!selected) return
    marketFetchAbortRef.current?.abort()
    const controller = new AbortController()
    marketFetchAbortRef.current = controller
    const requestSeq = marketFetchSeqRef.current + 1
    marketFetchSeqRef.current = requestSeq
    const ids = [...new Set(rows.map((r) => r.uniqueName).filter(Boolean))]
    if (ids.length === 0) return
    setShowPriceFetchFeedback(true)
    setShowPriceCityPicker(false)
    setPriceFetchStatus('loading')
    setPriceFetchMsg('Fetching prices…')
    try {
      const prices = await fetchPricesForItems(region, ids, city, controller.signal)
      if (requestSeq !== marketFetchSeqRef.current) return
      setUnitPrices((prev) => {
        const next = { ...prev }
        for (const [id, silver] of Object.entries(prices)) {
          const safeSilver = clampNonNegativeInt(silver, MAX_UNIT_PRICE)
          next[id] = safeSilver
        }
        saveStoredPrices(next)
        return next
      })
      setPriceFetchStatus('ok')
      const source = city === 'lowest' ? 'lowest price' : city
      const updated = Object.values(prices).filter((n) => Number.isFinite(n)).length
      setPriceFetchMsg(`Updated ${updated} prices (${source})`)
    } catch (e) {
      if (controller.signal.aborted) return
      if (requestSeq !== marketFetchSeqRef.current) return
      setPriceFetchStatus('err')
      setPriceFetchMsg(e instanceof Error ? e.message : 'Fetch failed')
    } finally {
      if (marketFetchAbortRef.current === controller) {
        marketFetchAbortRef.current = null
      }
    }
  }

  useEffect(() => {
    return () => {
      marketFetchAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowPriceFetchFeedback(false)
    setPriceFetchStatus('idle')
    setPriceFetchMsg('')
  }, [recipeStorageKey])

  useEffect(() => {
    if (!isBrewingKind(kind)) return
    if (!recipeStorageKey) return
    // Switching to a different potion should always start from default card controls.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCraftQty(defaultCraftQtyForKind(kind))
    setRegion('asia')
    setPriceCity('lowest')
    setShowPriceCityPicker(false)
  }, [kind, recipeStorageKey])

  useEffect(() => {
    saveStoredPriceCity(priceCity)
  }, [priceCity])

  useEffect(() => {
    if (!showPriceCityPicker) return
    const onPointerDown = (event: MouseEvent) => {
      const host = priceCityPickerRef.current
      if (!host) return
      if (!host.contains(event.target as Node)) {
        setShowPriceCityPicker(false)
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [showPriceCityPicker])

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
              <code className="inline-code">offhands_recipes.json</code>,{' '}
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
              <code className="inline-code">brewing_focus_recipes.json</code>,{' '}
              <code className="inline-code">cooking_stews_recipes.json</code>,{' '}
              <code className="inline-code">cooking_soups_recipes.json</code>,{' '}
              <code className="inline-code">cooking_salads_recipes.json</code>,{' '}
              <code className="inline-code">cooking_sandwiches_recipes.json</code>,{' '}
              <code className="inline-code">cooking_pies_recipes.json</code>,{' '}
              <code className="inline-code">cooking_omelettes_recipes.json</code>,{' '}
              <code className="inline-code">cooking_roasts_recipes.json</code>,{' '}
              <code className="inline-code">cooking_grilledfish_recipes.json</code>, and{' '}
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

  const renderTierControls = (mode: 'list' | 'selected') => {
    if (mode === 'selected') {
      if (
        !selected ||
        !supportsPreviewEnchant ||
        selectedTierValue == null ||
        selectedTierValue < enchantPreviewMinTier
      ) {
        return null
      }
      return (
        <div className="selection-tier-variants selection-tier-variants--filters">
          <span className="selection-tier-variants__label">Enchant</span>
          <div className="chip-row">
            {enchantDisplayValues.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip chip--enchant${listEnchantView === n ? ' is-active' : ''}`}
                aria-pressed={listEnchantView === n}
                onClick={() => setListEnchantView(n)}
              >
                {selectedTierValue}.{n}
              </button>
            ))}
          </div>
        </div>
      )
    }

    // Potions keep one continuous list; no top tier strip.
    if (isBrewingKind(kind)) return null

    return (
      <div className="selection-tier-variants selection-tier-variants--filters">
        <span className="selection-tier-variants__label">Tier</span>
        <div className="chip-row">
          {availableTiers.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip chip--tier${tierFilter === t ? ' is-active' : ''}`}
              aria-pressed={tierFilter === t}
              onClick={() => setTierFilter((cur) => (cur === t ? null : t))}
              title="Tap active tier again to clear."
            >
              T{t}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const hasActiveListFilters =
    query.trim().length > 0 ||
    tierFilter != null ||
    listEnchantView !== 0 ||
    selectedId != null ||
    (shopSub1Options != null && shopSub1Filter !== '')
  const selectedEnchantControls = selected ? renderTierControls('selected') : null

  return (
    <div className="planner">
      <div className="workspace">
        <section className="panel panel--armory">
          <h2 className="panel-title">{ui.panelTitle}</h2>

          <div className="search-block">
            <div className="search-wrap">
              <span className="search-icon" aria-hidden>
                {ui.searchIconItemId ? (
                  <ItemIcon
                    uniqueName={ui.searchIconItemId}
                    enchantmentLevel={ui.searchIconEnchantLevel}
                    localFolder={
                      isBrewingKind(kind)
                        ? 'alchemist'
                        : isCookingKind(kind)
                          ? 'cooking'
                          : kind === 'weapons'
                            ? 'weapons'
                            : kind === 'head'
                              ? 'head'
                              : kind === 'chest'
                                ? 'chest'
                                : kind === 'boots'
                                  ? 'boots'
                          : kind === 'offhands'
                            ? 'offhands'
                            : 'resources'
                    }
                    size={24}
                    className="search-icon__item search-icon__item--plain"
                    alt=""
                    showPreview={false}
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
              {shopSub1Options ? (
                <select
                  className="weapon-category-select"
                  value={shopSub1Filter}
                  onChange={(e) => setShopSub1Filter(e.target.value)}
                  aria-label={shopSub1FilterAriaLabel(kind)}
                >
                  {shopSub1Options.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="match-pill">
                  {listRows.length}{' '}
                  {listRows.length === 1 ? ui.itemSingular : ui.itemPlural}
                </span>
              )}
              <div className="search-meta__right">
                <p className="search-hint">Search, filters, and selection stack</p>
                <button
                  type="button"
                  className="search-clear-filters"
                  onClick={() => {
                    setQuery('')
                    setTierFilter(null)
                    setListEnchantView(0)
                    setSelectedId(null)
                    setRefiningVariantIndex(0)
                    setShopSub1Filter('')
                  }}
                  disabled={!hasActiveListFilters}
                >
                  Reset View
                </button>
              </div>
            </div>
            <div className="armory-tier-filters">{renderTierControls('list')}</div>
          </div>

          <div className="card-scroll card-scroll--weapons" role="region" aria-label={ui.listAria}>
            <div className="weapon-list" role="listbox">
              {listRows.length === 0 ? (
                <div className="list-empty">{ui.emptyList}</div>
              ) : (
                listRows.map((r) => {
                  const isSel = selectedId === r.uniqueName
                  const listIconUniqueName = r.uniqueName
                  return (
                  <button
                    key={r.uniqueName}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    className={`weapon-item${isSel ? ' is-selected' : ''}`}
                    ref={(el) => {
                      if (isSel) {
                        selectedListRowRef.current = el
                      } else if (selectedListRowRef.current === el) {
                        selectedListRowRef.current = null
                      }
                    }}
                    onClick={() => selectRecipe(r)}
                  >
                    <ItemIcon
                      uniqueName={listIconUniqueName}
                      enchantmentLevel={isRefiningSection ? undefined : listIconEnchant}
                      localFolder={outputLocalFolder}
                      size={42}
                      className="item-icon--list"
                      alt=""
                      hoverLabel={summarizeItemHoverLabel(
                        listIconUniqueName,
                        isRefiningSection ? undefined : listIconEnchant,
                        itemNames
                      )}
                      loading={isSel ? 'eager' : 'lazy'}
                      fetchPriority={isSel ? 'high' : undefined}
                    />
                    <span className="weapon-item__name">
                      {recipeRowDisplayLabel(r, itemNames)}
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
          <div className="workspace-detail-stack">
          <div className={selected ? selectedBannerClasses : 'selection-banner selection-banner--empty'}>
            {selected ? (
              <ItemIcon
                key={`${selectedDisplayUniqueName ?? selected.uniqueName}::${isRefiningSection ? 0 : (listIconEnchant ?? 0)}::${outputLocalFolder}`}
                uniqueName={selectedDisplayUniqueName ?? selected.uniqueName}
                enchantmentLevel={isRefiningSection ? undefined : listIconEnchant}
                localFolder={outputLocalFolder}
                size={72}
                className={selectedHeroIconClass}
                alt=""
                hoverLabel={summarizeItemHoverLabel(
                  selectedDisplayUniqueName ?? selected.uniqueName,
                  isRefiningSection ? undefined : listIconEnchant,
                  itemNames
                )}
                loading="eager"
                fetchPriority="high"
              />
            ) : (
              <div className="selection-banner__icon-placeholder" aria-hidden />
            )}
            <div className="selection-banner__text">
              <div className="selection-banner__label">{selected ? ui.selectionLabel : 'Selection'}</div>
              <div className="selection-banner__name">
                {selected
                  ? isRefiningSection
                  ? `${(
                      selectedTierValue != null
                        ? `${selectedTierValue}.${Math.min(maxEnchantDisplay, Math.max(0, listEnchantView))}`
                        : tierEnchantPrefix(selectedDisplayUniqueName ?? selected.uniqueName)
                    )} ${recipeRowDisplayLabel(selected, itemNames)}`.trim()
                  : formatItemDisplayName(selected.uniqueName, itemNames)
                  : 'No item selected'}
              </div>
              {selected && (selectedTierVariants.length > 1 || selectedEnchantControls) ? (
                <div className="selection-banner__variant-row">
                  {selectedTierVariants.length > 1 ? (
                    <div className="selection-tier-variants">
                      <span className="selection-tier-variants__label">All tiers</span>
                      <div className="chip-row">
                        {selectedTierVariants.map((r) => (
                          (() => {
                            const chipTier = r.tier ?? tierFromUniqueName(r.uniqueName)
                            const chipIsActive =
                              chipTier != null && selectedTierValue != null && chipTier === selectedTierValue
                            return (
                          <button
                            key={r.uniqueName}
                            type="button"
                            className={`chip chip--tier${chipIsActive ? ' is-active' : ''}`}
                            aria-pressed={chipIsActive}
                            onClick={() => {
                              if (!isRefiningSection || selectedRefiningFamily == null) {
                                selectRecipe(r)
                                return
                              }
                              const targetTier = r.tier ?? tierFromUniqueName(r.uniqueName)
                              if (targetTier == null) {
                                selectRecipe(r)
                                return
                              }
                              const sameFamilyTier = recipes.filter((x) => {
                                const rowTier = x.tier ?? tierFromUniqueName(x.uniqueName)
                                return rowTier === targetTier && itemTierFamilyKey(x.uniqueName) === selectedRefiningFamily
                              })
                              const sameFamilyTierList = sameFamilyTier.filter((x) => !/__ALT\d+$/i.test(x.uniqueName))
                              const preferredEnchant =
                                targetTier >= enchantPreviewMinTier && canUseRefiningEnchant ? listEnchantView : 0
                              const next =
                                sameFamilyTierList.find(
                                  (x) => refiningEnchantFromUniqueName(x.uniqueName) === preferredEnchant
                                ) ??
                                sameFamilyTierList.find((x) => refiningEnchantFromUniqueName(x.uniqueName) === 0) ??
                                sameFamilyTierList[0] ??
                                sameFamilyTier[0]
                              if (next) {
                                selectRecipe(next)
                              } else {
                                selectRecipe(r)
                              }
                            }}
                          >
                            T{r.tier ?? '?'}
                          </button>
                            )
                          })()
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {selectedEnchantControls}
                </div>
              ) : null}
              {selected && isRefiningSection && refiningVariants.length > 1 ? (
                <div className="selection-tier-variants selection-tier-variants--filters">
                  <span className="selection-tier-variants__label">Recipe</span>
                  <div className="chip-row">
                    {refiningVariants.map((v, idx) => (
                      <button
                        key={v.uniqueName}
                        type="button"
                        className={`chip chip--enchant${refiningVariantIndex === idx ? ' is-active' : ''}`}
                        aria-pressed={refiningVariantIndex === idx}
                        onClick={() => setRefiningVariantIndex(idx)}
                      >
                        {refiningVariantChipLabel(v, itemNames)}
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
                    <div className="input-stepper input-stepper--market">
                      <button
                        type="button"
                        className="input-stepper__btn"
                        aria-label="Decrease craft quantity"
                        onClick={() => setCraftQty((v) => clampCraftQtyWithMin(v - craftQtyStep, craftQtyMin))}
                        disabled={craftQty <= craftQtyMin}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={craftQtyMin}
                        max={MAX_CRAFT_QTY}
                        step={craftQtyStep}
                        className="input input--market input--qty input-stepper__input"
                        value={craftQty}
                        onChange={(e) => {
                          const next = Number(e.target.value || craftQtyMin)
                          setCraftQty(clampCraftQtyWithMin(next, craftQtyMin))
                        }}
                      />
                      <button
                        type="button"
                        className="input-stepper__btn"
                        aria-label="Increase craft quantity"
                        onClick={() => setCraftQty((v) => clampCraftQtyWithMin(v + craftQtyStep, craftQtyMin))}
                      >
                        +
                      </button>
                    </div>
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
                  <div ref={priceCityPickerRef} className="price-city-popover-wrap">
                    <button
                      type="button"
                      className="btn secondary btn--fetch"
                      disabled={!selected || priceFetchStatus === 'loading'}
                      onClick={() => setShowPriceCityPicker((v) => !v)}
                    >
                      {priceFetchStatus === 'loading' ? 'Fetching…' : 'Fetch prices'}
                    </button>
                    {showPriceCityPicker ? (
                      <div className="price-city-popover" role="dialog" aria-label="Choose city for price fetch">
                        <label className="field">
                          <span>City</span>
                          <select
                            className="input input--market"
                            value={priceCity}
                            onChange={(e) => setPriceCity(e.target.value as PriceCity)}
                          >
                            {PRICE_CITY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="price-city-popover__actions">
                          <button
                            type="button"
                            className="btn secondary"
                            onClick={() => setShowPriceCityPicker(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn secondary"
                            onClick={() => void fetchMarketPrices(priceCity)}
                          >
                            Fetch
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
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
                  {selected && displayRows.length > 0 ? (
                    displayRows.map((r) => (
                    <tr key={`${r.uniqueName}-${r.enchantmentLevel ?? 0}`}>
                      <ItemCell
                        uniqueName={r.uniqueName}
                        itemNames={itemNames}
                      />
                      <td>{r.requiredQty}</td>
                      <td>
                        <div className="input-stepper">
                          <button
                            type="button"
                            className="input-stepper__btn"
                            aria-label={`Decrease owned amount for ${formatItemDisplayName(r.uniqueName, itemNames)}`}
                            onClick={() => setOwnedQty(r.uniqueName, (owned[r.uniqueName] ?? 0) - 1)}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            className="input num input-stepper__input"
                            value={(owned[r.uniqueName] ?? 0) > 0 ? owned[r.uniqueName] : ''}
                            placeholder="0"
                            onChange={(e) =>
                              setOwnedQty(
                                r.uniqueName,
                                e.target.value === '' ? 0 : clampNonNegativeInt(Number(e.target.value), MAX_RESOURCE_QTY)
                              )
                            }
                          />
                          <button
                            type="button"
                            className="input-stepper__btn"
                            aria-label={`Increase owned amount for ${formatItemDisplayName(r.uniqueName, itemNames)}`}
                            onClick={() => setOwnedQty(r.uniqueName, (owned[r.uniqueName] ?? 0) + 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>{r.needBuy}</td>
                      <td>
                        <div className="input-stepper">
                          <button
                            type="button"
                            className="input-stepper__btn"
                            aria-label={`Decrease price for ${formatItemDisplayName(r.uniqueName, itemNames)}`}
                            onClick={() => setUnitPrice(r.uniqueName, (r.unit || 0) - 1)}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            className="input num input-stepper__input"
                            value={r.unit || ''}
                            placeholder="0"
                            onChange={(e) =>
                              setUnitPrice(
                                r.uniqueName,
                                e.target.value === '' ? 0 : clampNonNegativeInt(Number(e.target.value), MAX_UNIT_PRICE)
                              )
                            }
                          />
                          <button
                            type="button"
                            className="input-stepper__btn"
                            aria-label={`Increase price for ${formatItemDisplayName(r.uniqueName, itemNames)}`}
                            onClick={() => setUnitPrice(r.uniqueName, (r.unit || 0) + 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="num">{formatSilver(r.line)}</td>
                    </tr>
                    ))
                  ) : (
                    <tr className="cost-table__empty">
                      <td colSpan={6}>Select an item from the list to populate resources and silver totals.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </div>
            <div className="resources-summary">
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
                  onChange={(e) => setUsageFee(clampNonNegativeInt(Number(e.target.value || 0), MAX_USAGE_FEE))}
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
                  onChange={(e) => setRrr(clampNonNegativeFloat(Number(e.target.value || 0), MAX_RRR))}
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
