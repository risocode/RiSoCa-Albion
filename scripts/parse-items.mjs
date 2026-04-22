/**
 * Downloads ao-bin-dumps items.json and emits normalized craft recipes per gear category.
 * Run: node scripts/parse-items.mjs
 */
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'data')
const ITEMS_URL =
  'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json'
const LOCALIZATION_URL =
  'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/localization.json'
const NAMES_FILE = 'item_names_en.json'

/** @typedef {{ key: string, file: string, test: (o: Record<string, unknown>) => boolean }} Category */

const CATEGORIES = [
  {
    key: 'weapons',
    file: 'weapons_recipes.json',
    test(o) {
      if (o['@shopcategory'] !== 'weapons') return false
      const slot = o['@slottype']
      return slot === 'mainhand' || slot === 'offhand'
    },
  },
  {
    key: 'head',
    file: 'head_recipes.json',
    test(o) {
      return o['@shopcategory'] === 'head' && o['@slottype'] === 'head'
    },
  },
  {
    key: 'chest',
    file: 'chest_recipes.json',
    test(o) {
      return o['@shopcategory'] === 'armors' && o['@slottype'] === 'armor'
    },
  },
  {
    key: 'boots',
    file: 'boots_recipes.json',
    test(o) {
      return o['@shopcategory'] === 'shoes' && o['@slottype'] === 'shoes'
    },
  },
  {
    key: 'refining_cloth',
    file: 'refining_cloth_recipes.json',
    test(o) {
      const id = o['@uniquename']
      return (
        o['@shopcategory'] === 'crafting' &&
        typeof id === 'string' &&
        /^T\d+_CLOTH(?:_LEVEL\d+)?$/.test(id)
      )
    },
  },
  {
    key: 'refining_leather',
    file: 'refining_leather_recipes.json',
    test(o) {
      const id = o['@uniquename']
      return (
        o['@shopcategory'] === 'crafting' &&
        typeof id === 'string' &&
        /^T\d+_LEATHER(?:_LEVEL\d+)?$/.test(id)
      )
    },
  },
  {
    key: 'refining_metal_bars',
    file: 'refining_metal_bars_recipes.json',
    test(o) {
      const id = o['@uniquename']
      return (
        o['@shopcategory'] === 'crafting' &&
        typeof id === 'string' &&
        /^T\d+_METALBAR(?:_LEVEL\d+)?$/.test(id)
      )
    },
  },
  {
    key: 'refining_stone_block',
    file: 'refining_stone_block_recipes.json',
    test(o) {
      const id = o['@uniquename']
      return (
        o['@shopcategory'] === 'crafting' &&
        typeof id === 'string' &&
        /^T\d+_STONEBLOCK(?:_LEVEL\d+)?$/.test(id)
      )
    },
  },
  {
    key: 'refining_planks',
    file: 'refining_planks_recipes.json',
    test(o) {
      const id = o['@uniquename']
      return (
        o['@shopcategory'] === 'crafting' &&
        typeof id === 'string' &&
        /^T\d+_PLANKS(?:_LEVEL\d+)?$/.test(id)
      )
    },
  },
  {
    key: 'brewing_heal',
    file: 'brewing_heal_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'heal' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_energy',
    file: 'brewing_energy_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'energy' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_gigantify',
    file: 'brewing_gigantify_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'gigantify' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_resistance',
    file: 'brewing_resistance_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'resistance' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_sticky',
    file: 'brewing_sticky_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'slowfield' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_poison',
    file: 'brewing_poison_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'poison' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_invisibility',
    file: 'brewing_invisibility_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'invisibility' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_calming',
    file: 'brewing_calming_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'calming' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_cleansing',
    file: 'brewing_cleansing_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'cleanse' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_acid',
    file: 'brewing_acid_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'acid' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_berserk',
    file: 'brewing_berserk_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'berserk' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_hellfire',
    file: 'brewing_hellfire_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'lava' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_gathering',
    file: 'brewing_gathering_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'gather' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_tornado',
    file: 'brewing_tornado_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'tornado' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
  {
    key: 'brewing_focus',
    file: 'brewing_focus_recipes.json',
    test(o) {
      return (
        o['@shopsubcategory1'] === 'potions' &&
        o['@shopsubcategory2'] === 'focus' &&
        o['@shopcategory'] === 'consumables'
      )
    },
  },
]

function walk(obj, visit) {
  if (obj == null || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const el of obj) walk(el, visit)
    return
  }
  visit(obj)
  for (const v of Object.values(obj)) {
    if (v != null && typeof v === 'object') walk(v, visit)
  }
}

function normalizeCraftResources(crafting) {
  if (!crafting?.craftresource) return []
  const raw = crafting.craftresource
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr
    .map((r) => ({
      uniqueName: r['@uniquename'],
      count: Number(r['@count'] ?? 0),
      enchantmentLevel:
        r['@enchantmentlevel'] != null && r['@enchantmentlevel'] !== ''
          ? Number(r['@enchantmentlevel'])
          : undefined,
    }))
    .filter((r) => r.uniqueName && r.count > 0)
}

function getCraftingOptions(craftingrequirements) {
  if (!craftingrequirements) return []
  return Array.isArray(craftingrequirements) ? craftingrequirements : [craftingrequirements]
}

function pickPrimaryCraftingOption(craftingrequirements) {
  const options = getCraftingOptions(craftingrequirements)
  for (const option of options) {
    if (normalizeCraftResources(option).length > 0) return option
  }
  return null
}

/** Skip event/special/vanity/prototype items (not normal crafted gear). */
function isExcludedCraftItemId(id) {
  const u = id.toUpperCase()
  if (u.startsWith('UNIQUE_')) return true
  if (u.includes('PROTOTYPE')) return true
  if (u.includes('VANITY')) return true
  if (u.includes('IRONGAUNTLETS_HELL')) return true
  if (u.includes('BLACKHANDS') || u.includes('BLACK_HANDS')) return true
  return false
}

function isCraftableBase(o) {
  if (!o.craftingrequirements) return false
  const id = o['@uniquename']
  if (!id || typeof id !== 'string') return false
  if (isExcludedCraftItemId(id)) return false
  const primary = pickPrimaryCraftingOption(o.craftingrequirements)
  if (!primary) return false
  const resources = normalizeCraftResources(primary)
  return resources.length > 0
}

function recipeFromItem(o) {
  const cr = pickPrimaryCraftingOption(o.craftingrequirements)
  if (!cr) return null
  return {
    uniqueName: o['@uniquename'],
    tier: o['@tier'] != null ? Number(o['@tier']) : undefined,
    slotType: o['@slottype'],
    shopSub1: o['@shopsubcategory1'],
    shopSub2: o['@shopsubcategory2'],
    shopSub3: o['@shopsubcategory3'],
    stationSilver: Number(cr['@silver'] ?? 0),
    craftingFocus:
      cr['@craftingfocus'] != null && cr['@craftingfocus'] !== ''
        ? Number(cr['@craftingfocus'])
        : 0,
    craftTime:
      cr['@time'] != null && cr['@time'] !== '' ? Number(cr['@time']) : undefined,
    resources: normalizeCraftResources(cr),
  }
}

function tuvList(tu) {
  const t = tu.tuv
  if (!t) return []
  return Array.isArray(t) ? t : [t]
}

/**
 * @param {Set<string>} filterIds
 * @param {unknown} localizationRoot
 */
function buildEnglishItemNames(filterIds, localizationRoot) {
  const tu = localizationRoot?.tmx?.body?.tu
  if (!Array.isArray(tu)) return {}
  const prefix = '@ITEMS_'
  /** @type {Record<string, string>} */
  const out = {}
  for (const row of tu) {
    const tuid = row['@tuid']
    if (typeof tuid !== 'string' || !tuid.startsWith(prefix)) continue
    const id = tuid.slice(prefix.length)
    if (!filterIds.has(id)) continue
    const en = tuvList(row).find((x) => x['@xml:lang'] === 'EN-US')
    const seg = en?.seg
    if (typeof seg === 'string' && seg.trim().length > 0) out[id] = seg.trim()
  }
  return out
}

function collectMentionedItemIds(buckets) {
  const ids = new Set()
  for (const cat of CATEGORIES) {
    for (const r of buckets[cat.key]) {
      ids.add(r.uniqueName)
      for (const res of r.resources) ids.add(res.uniqueName)
    }
  }
  return ids
}

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'albion-craft-tool/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location
          res.resume()
          if (!loc) return reject(new Error('Redirect without location'))
          return resolve(download(loc.startsWith('http') ? loc : new URL(loc, url).href))
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

async function main() {
  const localPath = join(__dirname, 'items.json')
  let buf
  try {
    await access(localPath)
    buf = await readFile(localPath)
    console.log('Using local scripts/items.json')
  } catch {
    console.log('Fetching', ITEMS_URL)
    buf = await download(ITEMS_URL)
  }

  const text = buf.toString('utf8')
  const data = JSON.parse(text)

  const buckets = Object.fromEntries(CATEGORIES.map((c) => [c.key, []]))

  walk(data, (o) => {
    if (!isCraftableBase(o)) return
    for (const cat of CATEGORIES) {
      if (cat.test(o)) {
        const recipe = recipeFromItem(o)
        if (recipe) buckets[cat.key].push(recipe)
        return
      }
    }
  })

  await mkdir(OUT_DIR, { recursive: true })

  const mentionedIds = collectMentionedItemIds(buckets)
  const locPath = join(__dirname, 'localization.json')
  let locBuf
  try {
    await access(locPath)
    locBuf = await readFile(locPath)
    console.log('Using local scripts/localization.json')
  } catch {
    console.log('Fetching', LOCALIZATION_URL)
    locBuf = await download(LOCALIZATION_URL)
  }
  const nameMap = buildEnglishItemNames(mentionedIds, JSON.parse(locBuf.toString('utf8')))
  const sortedNames = Object.fromEntries(
    Object.entries(nameMap).sort(([a], [b]) => a.localeCompare(b))
  )
  const namesOut = join(OUT_DIR, NAMES_FILE)
  await writeFile(namesOut, JSON.stringify(sortedNames), 'utf8')
  console.log(`Wrote ${Object.keys(sortedNames).length} EN item names -> ${namesOut}`)

  for (const cat of CATEGORIES) {
    const recipes = buckets[cat.key]
    recipes.sort((a, b) => a.uniqueName.localeCompare(b.uniqueName))
    const outFile = join(OUT_DIR, cat.file)
    await pipeline(
      async function* () {
        yield JSON.stringify(
          {
            category: cat.key,
            generatedAt: new Date().toISOString(),
            count: recipes.length,
            recipes,
          },
          null,
          0
        )
      },
      createWriteStream(outFile)
    )
    console.log(`Wrote ${recipes.length} ${cat.key} recipes -> ${outFile}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
