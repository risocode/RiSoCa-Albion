import type { AodpRegion } from './types'

const GAMEINFO_PREFIX: Record<AodpRegion, string> = {
  americas: '/gameinfo-americas',
  europe: '/gameinfo-europe',
  asia: '/gameinfo-asia',
}

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
  const base = GAMEINFO_PREFIX[region]
  const path = `${base}/api/gameinfo/events/${encodeURIComponent(eventId)}`
  return await fetchJson<EventDetails>(path)
}
