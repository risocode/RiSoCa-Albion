/**
 * Downloads Albion item icons used by this project into `public/item-icons`.
 *
 * Usage:
 *   node scripts/download-item-icons.mjs
 *   node scripts/download-item-icons.mjs --force --size=128 --quality=1
 *   node scripts/download-item-icons.mjs --limit=100
 */
import https from 'node:https'
import { mkdir, readFile, writeFile, access, readdir, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_DIR = join(ROOT, 'public', 'data')
const OUT_DIR = join(ROOT, 'public', 'item-icons')
const RENDER_BASE = 'https://render.albiononline.com/v1/item'

const DATA_FILES = {
  weapons: 'weapons_recipes.json',
  head: 'head_recipes.json',
  chest: 'chest_recipes.json',
  boots: 'boots_recipes.json',
  refining_cloth: 'refining_cloth_recipes.json',
  refining_leather: 'refining_leather_recipes.json',
  refining_metal_bars: 'refining_metal_bars_recipes.json',
  refining_stone_block: 'refining_stone_block_recipes.json',
  refining_planks: 'refining_planks_recipes.json',
  brewing_heal: 'brewing_heal_recipes.json',
  brewing_energy: 'brewing_energy_recipes.json',
  brewing_gigantify: 'brewing_gigantify_recipes.json',
  brewing_resistance: 'brewing_resistance_recipes.json',
  brewing_sticky: 'brewing_sticky_recipes.json',
  brewing_poison: 'brewing_poison_recipes.json',
  brewing_invisibility: 'brewing_invisibility_recipes.json',
  brewing_calming: 'brewing_calming_recipes.json',
  brewing_cleansing: 'brewing_cleansing_recipes.json',
  brewing_acid: 'brewing_acid_recipes.json',
  brewing_berserk: 'brewing_berserk_recipes.json',
  brewing_hellfire: 'brewing_hellfire_recipes.json',
  brewing_gathering: 'brewing_gathering_recipes.json',
  brewing_tornado: 'brewing_tornado_recipes.json',
  brewing_focus: 'brewing_focus_recipes.json',
  cooking_stews: 'cooking_stews_recipes.json',
  cooking_soups: 'cooking_soups_recipes.json',
  cooking_salads: 'cooking_salads_recipes.json',
  cooking_sandwiches: 'cooking_sandwiches_recipes.json',
  cooking_pies: 'cooking_pies_recipes.json',
  cooking_omelettes: 'cooking_omelettes_recipes.json',
  cooking_roasts: 'cooking_roasts_recipes.json',
  cooking_grilledfish: 'cooking_grilledfish_recipes.json',
}

const FOLDERS = ['weapons', 'head', 'chest', 'boots', 'resources', 'alchemist', 'cooking']
const EXTRA_RESOURCE_ICON_IDS = [
  'T4_CLOTH',
  'T4_LEATHER',
  'T4_METALBAR',
  'T4_ROCK',
  'T4_PLANKS',
  'T6_POTION_HEAL',
  'T6_POTION_ENERGY',
  'T7_POTION_REVIVE',
  'T7_POTION_STONESKIN',
  'T7_POTION_SLOWFIELD',
  'T8_POTION_COOLDOWN',
  'T8_POTION_CLEANSE',
  'T7_POTION_MOB_RESET',
  'T7_POTION_CLEANSE2',
  'T7_POTION_ACID',
  'T8_POTION_BERSERK',
  'T8_POTION_LAVA',
  'T8_POTION_GATHER',
  'T8_POTION_TORNADO',
  'T8_FOCUSPOTION_NONTRADABLE',
]

function parseArgs(argv) {
  const out = {
    size: 128,
    quality: 1,
    force: false,
    concurrency: 10,
    limit: undefined,
  }
  for (const arg of argv) {
    if (arg === '--force') out.force = true
    else if (arg.startsWith('--size=')) out.size = Number(arg.split('=')[1] ?? 128)
    else if (arg.startsWith('--quality=')) out.quality = Number(arg.split('=')[1] ?? 1)
    else if (arg.startsWith('--concurrency=')) out.concurrency = Number(arg.split('=')[1] ?? 10)
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.split('=')[1])
  }
  if (!Number.isFinite(out.size) || out.size < 32) out.size = 128
  if (!Number.isFinite(out.quality) || out.quality < 1 || out.quality > 5) out.quality = 1
  if (!Number.isFinite(out.concurrency) || out.concurrency < 1) out.concurrency = 10
  if (out.limit != null && (!Number.isFinite(out.limit) || out.limit < 1)) out.limit = undefined
  return out
}

function buildItemRenderId(uniqueName, enchantmentLevel) {
  if (typeof uniqueName !== 'string' || uniqueName.length === 0) return null
  if (uniqueName.includes('@')) return uniqueName
  if (enchantmentLevel != null && Number(enchantmentLevel) > 0) {
    return `${uniqueName}@${Number(enchantmentLevel)}`
  }
  return uniqueName
}

function normalizeResourceRenderId(renderId) {
  if (typeof renderId !== 'string') return renderId
  return renderId.replace(/@\d+$/, '')
}

function iconFileNameFromRenderId(renderId) {
  return `${encodeURIComponent(renderId)}.png`
}

function iconDownloadUrl(renderId, { quality, size }) {
  const q = new URLSearchParams({ quality: String(quality), size: String(size) })
  return `${RENDER_BASE}/${encodeURIComponent(renderId)}.png?${q}`
}

function httpsGetBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'albion-craft-tool/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location
          res.resume()
          if (!loc) return reject(new Error('Redirect without location'))
          const next = loc.startsWith('http') ? loc : new URL(loc, url).href
          return resolve(httpsGetBuffer(next))
        }
        if (res.statusCode !== 200) {
          const status = res.statusCode
          res.resume()
          return reject(new Error(`HTTP ${status}`))
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

async function loadRecipePayload(fileName) {
  const raw = await readFile(join(DATA_DIR, fileName), 'utf8')
  return JSON.parse(raw)
}

function collectDownloadJobs(payloadByCategory) {
  const jobsByKey = new Map()
  const outputFolderForCategory = (category) => {
    if (category === 'weapons' || category === 'head' || category === 'chest' || category === 'boots') {
      return category
    }
    if (category.startsWith('brewing_')) return 'alchemist'
    if (category.startsWith('cooking_')) return 'cooking'
    return 'resources'
  }

  const addJob = (folder, renderId) => {
    if (!renderId) return
    const normalized = folder === 'resources' ? normalizeResourceRenderId(renderId) : renderId
    if (!normalized) return
    const key = `${folder}/${normalized}`
    if (jobsByKey.has(key)) return
    jobsByKey.set(key, { folder, renderId: normalized })
  }

  for (const [category, payload] of Object.entries(payloadByCategory)) {
    const outputFolder = outputFolderForCategory(category)
    const recipes = Array.isArray(payload?.recipes) ? payload.recipes : []
    for (const recipe of recipes) {
      const main = buildItemRenderId(recipe.uniqueName)
      addJob(outputFolder, main)

      // UI supports enchant preview chips at T4+ (.1-.4)
      if (outputFolder !== 'resources' && Number(recipe.tier) >= 4) {
        const maxEnchant = outputFolder === 'alchemist' || outputFolder === 'cooking' ? 3 : 4
        for (let e = 1; e <= maxEnchant; e += 1) {
          const ench = buildItemRenderId(recipe.uniqueName, e)
          addJob(outputFolder, ench)
        }
      }

      const resources = Array.isArray(recipe.resources) ? recipe.resources : []
      for (const r of resources) {
        const resId = buildItemRenderId(r.uniqueName, r.enchantmentLevel)
        addJob('resources', resId)
      }
    }
  }

  for (const id of EXTRA_RESOURCE_ICON_IDS) {
    addJob('resources', id)
  }

  return [...jobsByKey.values()].sort((a, b) => {
    const byFolder = a.folder.localeCompare(b.folder)
    if (byFolder !== 0) return byFolder
    return a.renderId.localeCompare(b.renderId)
  })
}

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function runPool(items, limit, worker) {
  let idx = 0
  const workers = new Array(limit).fill(0).map(async () => {
    while (idx < items.length) {
      const cur = idx
      idx += 1
      await worker(items[cur], cur)
    }
  })
  await Promise.all(workers)
}

async function cleanupEncodedResourceVariants() {
  const resourcesDir = join(OUT_DIR, 'resources')
  const names = await readdir(resourcesDir)
  const duplicateSuffix = /%40[1-4]\.png$/i
  let removed = 0
  for (const name of names) {
    if (!duplicateSuffix.test(name)) continue
    await unlink(join(resourcesDir, name))
    removed += 1
  }
  if (removed > 0) {
    console.log(`Removed ${removed} stale encoded resource variants (%401-%404).`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  await mkdir(OUT_DIR, { recursive: true })
  for (const folder of FOLDERS) {
    await mkdir(join(OUT_DIR, folder), { recursive: true })
  }
  await cleanupEncodedResourceVariants()

  /** @type {Record<string, unknown>} */
  const payloadByCategory = {}
  for (const [category, fileName] of Object.entries(DATA_FILES)) {
    payloadByCategory[category] = await loadRecipePayload(fileName)
  }

  let jobs = collectDownloadJobs(payloadByCategory)
  if (options.limit != null) jobs = jobs.slice(0, options.limit)

  console.log(
    `Preparing ${jobs.length} icons in category folders (size=${options.size}, quality=${options.quality}, force=${options.force})`
  )

  const stats = {
    downloaded: 0,
    skipped: 0,
    failed: 0,
  }
  const failures = []

  await runPool(jobs, options.concurrency, async (job, i) => {
    const { folder, renderId } = job
    const fileName = iconFileNameFromRenderId(renderId)
    const outPath = join(OUT_DIR, folder, fileName)
    if (!options.force && (await fileExists(outPath))) {
      stats.skipped += 1
      return
    }

    const url = iconDownloadUrl(renderId, options)
    try {
      const png = await httpsGetBuffer(url)
      await writeFile(outPath, png)
      stats.downloaded += 1
      if ((i + 1) % 100 === 0) {
        console.log(`Progress: ${i + 1}/${jobs.length}`)
      }
    } catch (err) {
      stats.failed += 1
      failures.push({
        id: renderId,
        folder,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })

  const pathsById = {}
  for (const { folder, renderId } of jobs) {
    if (!pathsById[renderId]) {
      pathsById[renderId] = `/item-icons/${folder}/${iconFileNameFromRenderId(renderId)}`
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    basePath: '/item-icons',
    folders: FOLDERS,
    source: 'https://render.albiononline.com/v1/item',
    quality: options.quality,
    size: options.size,
    totalIds: jobs.length,
    downloaded: stats.downloaded,
    skipped: stats.skipped,
    failed: stats.failed,
    ids: jobs.map((j) => j.renderId),
    pathsById,
    failedIds: failures,
  }
  await writeFile(join(DATA_DIR, 'item_icon_manifest.json'), JSON.stringify(manifest), 'utf8')

  console.log(
    `Done. downloaded=${stats.downloaded} skipped=${stats.skipped} failed=${stats.failed}`
  )
  console.log('Wrote manifest -> public/data/item_icon_manifest.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

