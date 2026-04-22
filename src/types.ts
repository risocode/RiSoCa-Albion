export type CraftResource = {
  uniqueName: string
  count: number
  enchantmentLevel?: number
}

export type CraftRecipe = {
  uniqueName: string
  tier?: number
  slotType: string
  shopSub1?: string
  shopSub2?: string
  shopSub3?: string
  stationSilver: number
  craftingFocus: number
  craftTime?: number
  resources: CraftResource[]
}

/** @deprecated use CraftRecipe */
export type WeaponRecipe = CraftRecipe

export type RecipesPayload = {
  category?: string
  generatedAt: string
  count: number
  recipes: CraftRecipe[]
}

/** @deprecated use RecipesPayload */
export type WeaponsPayload = RecipesPayload

export type CraftPlannerKind =
  | 'weapons'
  | 'head'
  | 'chest'
  | 'boots'
  | 'refining_cloth'
  | 'refining_leather'
  | 'refining_metal_bars'
  | 'refining_stone_block'
  | 'refining_planks'
  | 'brewing_heal'
  | 'brewing_energy'
  | 'brewing_gigantify'
  | 'brewing_resistance'
  | 'brewing_sticky'
  | 'brewing_poison'
  | 'brewing_invisibility'
  | 'brewing_calming'
  | 'brewing_cleansing'
  | 'brewing_acid'
  | 'brewing_berserk'
  | 'brewing_hellfire'
  | 'brewing_gathering'
  | 'brewing_tornado'
  | 'brewing_focus'

export type WorkshopSection =
  | 'weapons'
  | 'head'
  | 'chest'
  | 'boots'
  | 'brewing'
  | 'refining_cloth'
  | 'refining_leather'
  | 'refining_metal_bars'
  | 'refining_stone_block'
  | 'refining_planks'
  | 'brewing_heal'
  | 'brewing_energy'
  | 'brewing_gigantify'
  | 'brewing_resistance'
  | 'brewing_sticky'
  | 'brewing_poison'
  | 'brewing_invisibility'
  | 'brewing_calming'
  | 'brewing_cleansing'
  | 'brewing_acid'
  | 'brewing_berserk'
  | 'brewing_hellfire'
  | 'brewing_gathering'
  | 'brewing_tornado'
  | 'brewing_focus'

export type AodpRegion = 'americas' | 'europe' | 'asia'

export type AodpPriceRow = {
  item_id: string
  city: string
  quality: number
  sell_price_min: number
  sell_price_max: number
  buy_price_min: number
  buy_price_max: number
}
