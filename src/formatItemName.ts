/** Map of item `uniqueName` → English display string (from ao-bin-dumps localization). */
export type ItemNameMap = Record<string, string>

const TIER_PREFIX_RE =
  /^(Beginner's|Novice's|Journeyman's|Adept's|Expert's|Master's|Grandmaster's|Elder's)\s+/i

/**
 * UI label: official EN name when present (from `item_names_en.json`), else id with underscores → spaces; ALL CAPS.
 */
export function formatItemDisplayName(
  uniqueName: string,
  names?: ItemNameMap | null
): string {
  const localized = names?.[uniqueName]?.trim()
  const base =
    localized && localized.length > 0
      ? localized
      : uniqueName.replaceAll('_', ' ')
  return base.toUpperCase()
}

/** Search matches raw id, id-with-spaces, or localized name (if loaded). */
export function itemMatchesSearchQuery(
  uniqueName: string,
  q: string,
  names?: ItemNameMap | null
): boolean {
  if (!q) return true
  const ql = q.toLowerCase()
  const lower = uniqueName.toLowerCase()
  const spaced = lower.replaceAll('_', ' ')
  const disp = (names?.[uniqueName] ?? '').toLowerCase()
  return lower.includes(ql) || spaced.includes(ql) || disp.includes(ql)
}

function titleCaseWords(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

function parseTier(uniqueName: string): number | null {
  const m = uniqueName.match(/^T(\d+)_/)
  return m ? Number(m[1]) : null
}

function parseEnchantFromId(uniqueName: string): number | null {
  const at = uniqueName.match(/@([1-4])$/)
  if (at) return Number(at[1])
  const m = uniqueName.match(/_LEVEL([1-4])$/)
  return m ? Number(m[1]) : null
}

function normalizeNameLookupKey(uniqueName: string): string {
  return uniqueName.replace(/@[1-4]$/, '').replace(/_LEVEL[1-4]$/, '')
}

function removeSetSuffix(name: string): string {
  return name.replace(/\s+Set\s*\d+\b/gi, '').trim()
}

function summarizedBaseName(uniqueName: string, names?: ItemNameMap | null): string {
  const normalized = uniqueName.toUpperCase()
  // Keep generic material labels only for pure refined resource IDs.
  const refinedResource = normalized.match(
    /^T\d+_(PLANKS|CLOTH|LEATHER|METALBAR|STONEBLOCK)(?:_LEVEL[1-4]|@[1-4])?$/
  )
  if (refinedResource) {
    if (refinedResource[1] === 'PLANKS') return 'Planks'
    if (refinedResource[1] === 'CLOTH') return 'Cloth'
    if (refinedResource[1] === 'LEATHER') return 'Leather'
    if (refinedResource[1] === 'METALBAR') return 'Metal Bars'
    if (refinedResource[1] === 'STONEBLOCK') return 'Stone Blocks'
  }

  const lookupKey = normalizeNameLookupKey(uniqueName)
  const localized = (names?.[uniqueName] ?? names?.[lookupKey])?.trim()
  if (localized) return removeSetSuffix(localized.replace(TIER_PREFIX_RE, ''))

  const compact = uniqueName
    .replace(/^T\d+_/, '')
    .replace(/_LEVEL\d+$/, '')
    .replace(/@[1-4]$/, '')
    .replace(/_SET\d+\b/gi, '')
  return titleCaseWords(compact.replaceAll('_', ' '))
}

/** Short hover summary, e.g. `6.4 Planks`, `5.4 Demonic Staff`. */
export function summarizeItemHoverLabel(
  uniqueName: string,
  enchantmentLevel?: number,
  names?: ItemNameMap | null
): string {
  const tier = parseTier(uniqueName)
  const ench = enchantmentLevel ?? parseEnchantFromId(uniqueName) ?? 0
  const prefix = tier != null ? `${tier}.${ench}` : ench > 0 ? `?.${ench}` : ''
  const base = summarizedBaseName(uniqueName, names)
  return prefix ? `${prefix} ${base}` : base
}
