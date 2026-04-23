import type { AodpRegion } from './types'

const GAMEINFO_PREFIX: Record<AodpRegion, string> = {
  americas: '/gameinfo-americas',
  europe: '/gameinfo-europe',
  asia: '/gameinfo-asia',
}

const EVENT_DETAILS_TTL_MS = 5 * 60 * 1000
const EVENT_DETAILS_CACHE_PREFIX = 'event-details-cache::'

type EventDetailsCacheEntry = {
  ts: number
  data: EventDetails
}

const eventDetailsMemoryCache = new Map<string, EventDetailsCacheEntry>()
const eventDetailsInFlight = new Map<string, Promise<EventDetails>>()

export type PlayerSearchResult = {
  id: string
  name: string
  guildName?: string
  allianceName?: string
}

export type PlayerProfile = {
  Id: string
  Name: string
  GuildName?: string
  GuildId?: string
  AllianceName?: string
  AllianceId?: string
  KillFame?: number
  DeathFame?: number
  FameRatio?: number
  LifetimeStatistics?: Record<string, unknown>
  [key: string]: unknown
}

export type PlayerEvent = {
  EventId?: number | string
  TimeStamp?: string
  TotalVictimKillFame?: number
  Killer?: {
    Name?: string
    Id?: string
    GuildName?: string
    GuildId?: string
    AllianceName?: string
    AllianceId?: string
  } | null
  Killers?: Array<{
    Name?: string
    Id?: string
    GuildName?: string
    GuildId?: string
    AllianceName?: string
    AllianceId?: string
  }>
  Victim?: {
    Name?: string
    Id?: string
    GuildName?: string
    GuildId?: string
    AllianceName?: string
    AllianceId?: string
  } | null
  [key: string]: unknown
}

export type EventItem = {
  Type?: string
  Count?: number
  Quality?: number
  [key: string]: unknown
}

export type EventActor = {
  Name?: string
  Id?: string
  GuildName?: string
  GuildId?: string
  AllianceName?: string
  AllianceId?: string
  AllianceTag?: string
  AverageItemPower?: number
  Equipment?: Record<string, EventItem | null | undefined>
  Inventory?: EventItem[]
  [key: string]: unknown
}

export type EventDetails = {
  EventId?: number | string
  TimeStamp?: string
  TotalVictimKillFame?: number
  Location?: string
  Killer?: EventActor | null
  Victim?: EventActor | null
  Participants?: EventActor[]
  GroupMembers?: EventActor[]
  numberOfParticipants?: number
  groupMemberCount?: number
  [key: string]: unknown
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`GameInfo ${res.status}`)
  }
  return (await res.json()) as T
}

function eventDetailsKey(region: AodpRegion, eventId: string): string {
  return `${region}:${eventId.trim()}`
}

function isFreshCache(entry: EventDetailsCacheEntry | null): entry is EventDetailsCacheEntry {
  return !!entry && Date.now() - entry.ts < EVENT_DETAILS_TTL_MS
}

function readEventDetailsSessionCache(key: string): EventDetailsCacheEntry | null {
  try {
    const raw = window.sessionStorage.getItem(`${EVENT_DETAILS_CACHE_PREFIX}${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EventDetailsCacheEntry
    if (!parsed || typeof parsed.ts !== 'number' || typeof parsed.data !== 'object' || parsed.data == null) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeEventDetailsSessionCache(key: string, entry: EventDetailsCacheEntry): void {
  try {
    window.sessionStorage.setItem(`${EVENT_DETAILS_CACHE_PREFIX}${key}`, JSON.stringify(entry))
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
}

function cacheEventDetails(key: string, data: EventDetails): EventDetails {
  const entry: EventDetailsCacheEntry = { ts: Date.now(), data }
  eventDetailsMemoryCache.set(key, entry)
  writeEventDetailsSessionCache(key, entry)
  return data
}

export function getCachedEventDetails(region: AodpRegion, eventId: string): EventDetails | null {
  const key = eventDetailsKey(region, eventId)
  const mem = eventDetailsMemoryCache.get(key) ?? null
  if (isFreshCache(mem)) return mem.data
  if (mem) eventDetailsMemoryCache.delete(key)

  const session = readEventDetailsSessionCache(key)
  if (isFreshCache(session)) {
    eventDetailsMemoryCache.set(key, session)
    return session.data
  }
  return null
}

function looksLikePlayer(entry: Record<string, unknown>): boolean {
  const explicitType = String(entry.Type ?? entry.type ?? '').toLowerCase()
  if (explicitType.length > 0) return explicitType.includes('player')
  if ('GuildName' in entry || 'KillFame' in entry || 'LifetimeStatistics' in entry) return true
  if ('AllianceTag' in entry && !('GuildName' in entry)) return false
  return true
}

function normalizeSearchEntry(entry: Record<string, unknown>): PlayerSearchResult | null {
  const id = entry.Id
  const name = entry.Name
  if (typeof id !== 'string' || typeof name !== 'string') return null
  return {
    id,
    name,
    guildName: typeof entry.GuildName === 'string' ? entry.GuildName : undefined,
    allianceName: typeof entry.AllianceName === 'string' ? entry.AllianceName : undefined,
  }
}

export async function searchPlayersByIgn(
  region: AodpRegion,
  ign: string
): Promise<PlayerSearchResult[]> {
  const q = ign.trim()
  if (!q) return []
  const base = GAMEINFO_PREFIX[region]
  const path = `${base}/api/gameinfo/search?q=${encodeURIComponent(q)}`
  const raw = await fetchJson<unknown>(path)
  const entries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { players?: unknown[] }).players)
      ? (raw as { players: unknown[] }).players
      : []
  const out: PlayerSearchResult[] = []
  for (const row of entries) {
    if (!row || typeof row !== 'object') continue
    if (!looksLikePlayer(row as Record<string, unknown>)) continue
    const normalized = normalizeSearchEntry(row as Record<string, unknown>)
    if (normalized) out.push(normalized)
  }
  return out
}

export async function fetchPlayerProfile(region: AodpRegion, playerId: string): Promise<PlayerProfile> {
  const base = GAMEINFO_PREFIX[region]
  const path = `${base}/api/gameinfo/players/${encodeURIComponent(playerId)}`
  return await fetchJson<PlayerProfile>(path)
}

export async function fetchPlayerKills(region: AodpRegion, playerId: string): Promise<PlayerEvent[]> {
  const base = GAMEINFO_PREFIX[region]
  const path = `${base}/api/gameinfo/players/${encodeURIComponent(playerId)}/kills`
  const data = await fetchJson<unknown>(path)
  return Array.isArray(data) ? (data as PlayerEvent[]) : []
}

export async function fetchPlayerDeaths(region: AodpRegion, playerId: string): Promise<PlayerEvent[]> {
  const base = GAMEINFO_PREFIX[region]
  const path = `${base}/api/gameinfo/players/${encodeURIComponent(playerId)}/deaths`
  const data = await fetchJson<unknown>(path)
  return Array.isArray(data) ? (data as PlayerEvent[]) : []
}

export async function fetchEventDetails(region: AodpRegion, eventId: string): Promise<EventDetails> {
  const key = eventDetailsKey(region, eventId)
  const cached = getCachedEventDetails(region, eventId)
  if (cached) return cached

  const inFlight = eventDetailsInFlight.get(key)
  if (inFlight) return inFlight

  const base = GAMEINFO_PREFIX[region]
  const path = `${base}/api/gameinfo/events/${encodeURIComponent(eventId)}`
  const request = fetchJson<EventDetails>(path)
    .then((data) => cacheEventDetails(key, data))
    .finally(() => {
      eventDetailsInFlight.delete(key)
    })
  eventDetailsInFlight.set(key, request)
  return await request
}
