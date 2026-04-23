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
  /** Set by parser for alternate refining paths (e.g. rockheart vs enchanted basalt). */
  recipeVariantTag?: string
}

export type RecipesPayload = {
  category?: string
  generatedAt: string
  count: number
  recipes: CraftRecipe[]
}

export type CraftPlannerKind =
  | 'weapons'
  | 'offhands'
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
  | 'cooking_stews'
  | 'cooking_soups'
  | 'cooking_salads'
  | 'cooking_sandwiches'
  | 'cooking_pies'
  | 'cooking_omelettes'
  | 'cooking_roasts'
  | 'cooking_grilledfish'

export type WorkshopSection =
  | 'player_lookup'
  | 'weapons'
  | 'offhands'
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
  | 'cooking_stews'
  | 'cooking_soups'
  | 'cooking_salads'
  | 'cooking_sandwiches'
  | 'cooking_pies'
  | 'cooking_omelettes'
  | 'cooking_roasts'
  | 'cooking_grilledfish'

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
