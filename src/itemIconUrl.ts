const LOCAL_ICON_BASE = '/item-icons'

/** Parser may append `__ALT2` etc. for alternate refining recipes — strip for real item ids. */
export function stripCraftRecipeVariantSuffix(uniqueName: string): string {
  return uniqueName.replace(/__ALT\d+$/i, '')
}
export type LocalIconFolder =
  | 'weapons'
  | 'offhands'
  | 'head'
  | 'chest'
  | 'boots'
  | 'resources'
  | 'alchemist'
  | 'cooking'

/** Build render API item id (supports enchant suffix `ITEM@1`). */
export function buildItemRenderId(uniqueName: string, enchantmentLevel?: number): string {
  uniqueName = stripCraftRecipeVariantSuffix(uniqueName)
  if (uniqueName.includes('@')) return uniqueName
  if (enchantmentLevel != null && enchantmentLevel > 0) {
    return `${uniqueName}@${enchantmentLevel}`
  }
  return uniqueName
}

/** Local cache path under `public/item-icons/` (file names are URI-encoded render IDs). */
export function localItemIconUrl(
  folder: LocalIconFolder,
  uniqueName: string,
  enchantmentLevel?: number
): string {
  const id = buildItemRenderId(uniqueName, enchantmentLevel)
  return `${LOCAL_ICON_BASE}/${folder}/${encodeURIComponent(id)}.png`
}
