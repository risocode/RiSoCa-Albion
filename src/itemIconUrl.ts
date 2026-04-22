const RENDER_BASE = 'https://render.albiononline.com/v1/item'
const LOCAL_ICON_BASE = '/item-icons'
export type LocalIconFolder =
  | 'weapons'
  | 'head'
  | 'chest'
  | 'boots'
  | 'resources'
  | 'alchemist'
  | 'cooking'

export type ItemIconUrlOptions = {
  /** Item quality tier for the render (1–5). Default 1. */
  quality?: number
  /** Pixel width/height. Default 64. */
  size?: number
  /** Mat enchant from recipe (.1 → 1). Ignored if `uniqueName` already contains `@`. */
  enchantmentLevel?: number
}

/** Build render API item id (supports enchant suffix `ITEM@1`). */
export function buildItemRenderId(uniqueName: string, enchantmentLevel?: number): string {
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

/** Official Albion item icon PNG URL (Sandbox Interactive render service). */
export function itemIconUrl(uniqueName: string, options?: ItemIconUrlOptions): string {
  const { quality = 1, size = 64, enchantmentLevel } = options ?? {}
  const id = buildItemRenderId(uniqueName, enchantmentLevel)
  const params = new URLSearchParams({
    quality: String(quality),
    size: String(size),
  })
  return `${RENDER_BASE}/${id}.png?${params}`
}
