import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { BattleDetailsPage } from './BattleDetailsPage'
import {
  fetchPlayerDeaths,
  fetchPlayerKills,
  fetchPlayerProfile,
  searchPlayersByIgn,
  type PlayerEvent,
  type PlayerProfile,
  type PlayerSearchResult,
} from './gameInfo'
import type { AodpRegion } from './types'

const REGION_OPTIONS: Array<{ value: AodpRegion; label: string }> = [
  { value: 'americas', label: 'Americas' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
]

function formatNumber(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
  return n.toLocaleString()
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function pickKillerName(event: PlayerEvent): string {
  const direct = event.Killer?.Name
  if (typeof direct === 'string' && direct.trim().length > 0) return direct
  const firstAssist = event.Killers?.[0]?.Name
  if (typeof firstAssist === 'string' && firstAssist.trim().length > 0) return firstAssist
  return 'Unknown'
}

function eventTimestamp(event: PlayerEvent): string {
  const raw = event.TimeStamp
  if (!raw) return 'Unknown time'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString()
}

function eventFame(event: PlayerEvent): number {
  const direct = asNumber(event.TotalVictimKillFame)
  return direct ?? 0
}

function eventVictimName(event: PlayerEvent): string {
  const victim = event.Victim?.Name
  return typeof victim === 'string' && victim.trim().length > 0 ? victim : 'Unknown'
}

function eventId(event: PlayerEvent): string | null {
  const raw = event.EventId
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim()
  return null
}

function eventDetailsId(event: PlayerEvent): string | null {
  const id = eventId(event)
  if (!id) return null
  return id
}

function lifetimeStats(profile: PlayerProfile): Record<string, unknown> {
  const stats = profile.LifetimeStatistics
  return stats && typeof stats === 'object' && !Array.isArray(stats)
    ? (stats as Record<string, unknown>)
    : {}
}

function nestedNumber(
  source: Record<string, unknown>,
  key: string,
  nestedKey: string
): number | undefined {
  const top = source[key]
  if (top && typeof top === 'object' && !Array.isArray(top)) {
    return asNumber((top as Record<string, unknown>)[nestedKey])
  }
  return asNumber(top)
}

function nestedStatsObject(
  source: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const value = source[key]
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

type GuildHistoryEntry = {
  key: string
  guildName: string
  allianceName: string
  firstSeen: number
  lastSeen: number
  appearances: number
}

function deriveGuildHistory(
  profile: PlayerProfile,
  kills: PlayerEvent[],
  deaths: PlayerEvent[]
): GuildHistoryEntry[] {
  const playerId = String(profile.Id ?? '')
  const byGuild = new Map<string, GuildHistoryEntry>()

  const touch = (guildName: string, allianceName: string, when: number) => {
    const key = `${guildName}||${allianceName}`
    const existing = byGuild.get(key)
    if (!existing) {
      byGuild.set(key, {
        key,
        guildName,
        allianceName,
        firstSeen: when,
        lastSeen: when,
        appearances: 1,
      })
      return
    }
    existing.firstSeen = Math.min(existing.firstSeen, when)
    existing.lastSeen = Math.max(existing.lastSeen, when)
    existing.appearances += 1
  }

  for (const event of kills) {
    const killer = event.Killer
    if (!killer || killer.Id !== playerId) continue
    const ts = event.TimeStamp ? new Date(event.TimeStamp).getTime() : Date.now()
    const guildName =
      typeof killer.GuildName === 'string' && killer.GuildName.trim().length > 0
        ? killer.GuildName
        : 'No guild'
    const allianceName =
      typeof killer.AllianceName === 'string' && killer.AllianceName.trim().length > 0
        ? killer.AllianceName
        : ''
    touch(guildName, allianceName, Number.isNaN(ts) ? Date.now() : ts)
  }

  for (const event of deaths) {
    const victim = event.Victim
    if (!victim || victim.Id !== playerId) continue
    const ts = event.TimeStamp ? new Date(event.TimeStamp).getTime() : Date.now()
    const guildName =
      typeof victim.GuildName === 'string' && victim.GuildName.trim().length > 0
        ? victim.GuildName
        : 'No guild'
    const allianceName =
      typeof victim.AllianceName === 'string' && victim.AllianceName.trim().length > 0
        ? victim.AllianceName
        : ''
    touch(guildName, allianceName, Number.isNaN(ts) ? Date.now() : ts)
  }

  const currentGuild =
    typeof profile.GuildName === 'string' && profile.GuildName.trim().length > 0
      ? profile.GuildName
      : 'No guild'
  const currentAlliance =
    typeof profile.AllianceName === 'string' && profile.AllianceName.trim().length > 0
      ? profile.AllianceName
      : ''
  if (!byGuild.has(`${currentGuild}||${currentAlliance}`)) {
    touch(currentGuild, currentAlliance, Date.now())
  }

  return [...byGuild.values()].sort((a, b) => b.lastSeen - a.lastSeen)
}

export function PlayerLookupPanel() {
  const [region, setRegion] = useState<AodpRegion>('asia')
  const [ign, setIgn] = useState('')
  const [matches, setMatches] = useState<PlayerSearchResult[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [kills, setKills] = useState<PlayerEvent[]>([])
  const [deaths, setDeaths] = useState<PlayerEvent[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)
  const [detailRegion, setDetailRegion] = useState<AodpRegion>('asia')
  const battleModalRef = useRef<HTMLElement | null>(null)
  const [battleModalScale, setBattleModalScale] = useState(1)

  useEffect(() => {
    if (!detailEventId) {
      setBattleModalScale(1)
      return
    }

    const fitToViewport = () => {
      const target = battleModalRef.current
      if (!target) return
      const viewportPad = 24
      const availableWidth = Math.max(220, window.innerWidth - viewportPad * 2)
      const availableHeight = Math.max(220, window.innerHeight - viewportPad * 2)
      const naturalWidth = Math.max(1, target.offsetWidth)
      const naturalHeight = Math.max(1, target.offsetHeight)
      const nextScale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight)
      setBattleModalScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1)
    }

    const frame = window.requestAnimationFrame(fitToViewport)
    window.addEventListener('resize', fitToViewport)
    const resizeObserver = new ResizeObserver(() => fitToViewport())
    if (battleModalRef.current) {
      resizeObserver.observe(battleModalRef.current)
    }

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', fitToViewport)
      resizeObserver.disconnect()
    }
  }, [detailEventId])

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === selectedPlayerId) ?? null,
    [matches, selectedPlayerId]
  )

  const stats = useMemo(() => {
    if (!profile) return {}
    return lifetimeStats(profile)
  }, [profile])

  const pveFame = nestedNumber(stats, 'PvE', 'Total')
  const gatheringFame = nestedNumber(stats, 'Gathering', 'All')
  const craftingFame = nestedNumber(stats, 'Crafting', 'Total')
  const pveStats = nestedStatsObject(stats, 'PvE')
  const gatheringStats = nestedStatsObject(stats, 'Gathering')
  const craftingStats = nestedStatsObject(stats, 'Crafting')
  const guildHistory = useMemo(() => {
    if (!profile) return []
    return deriveGuildHistory(profile, kills, deaths)
  }, [profile, kills, deaths])

  const loadPlayerDetails = async (playerId: string) => {
    setIsLoadingDetails(true)
    setError(null)
    setSelectedPlayerId(playerId)
    try {
      const [player, playerKills, playerDeaths] = await Promise.all([
        fetchPlayerProfile(region, playerId),
        fetchPlayerKills(region, playerId),
        fetchPlayerDeaths(region, playerId),
      ])
      setProfile(player)
      setKills(playerKills)
      setDeaths(playerDeaths)
    } catch (e) {
      setProfile(null)
      setKills([])
      setDeaths([])
      setError(e instanceof Error ? e.message : 'Failed to load player details.')
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const onSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = ign.trim()
    if (!query) {
      setError('Enter a player IGN to search.')
      return
    }

    setIsSearching(true)
    setError(null)
    setProfile(null)
    setKills([])
    setDeaths([])
    setSelectedPlayerId(null)
    setDetailEventId(null)
    try {
      const found = await searchPlayersByIgn(region, query)
      setMatches(found)
      if (found.length === 0) {
        setError('No players found for that IGN in this region.')
        return
      }
      const exact = found.find((p) => p.name.toLowerCase() === query.toLowerCase()) ?? found[0]
      await loadPlayerDetails(exact.id)
    } catch (e) {
      setMatches([])
      setError(e instanceof Error ? e.message : 'Failed to search player.')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="planner">
      <section className="panel panel--player-lookup">
        <div className="player-lookup__banner">
          <div>
            <h2 className="panel-title player-lookup__title">Player Look-Up</h2>
            <p className="player-lookup__subtitle">Track fame, guild identity, and recent combat records.</p>
          </div>
          <div className="player-lookup__region-tag">
            Region: {REGION_OPTIONS.find((opt) => opt.value === region)?.label ?? region}
          </div>
        </div>
        <form className="player-lookup__controls" onSubmit={onSearchSubmit}>
          <label className="field player-lookup__field">
            <span>Region</span>
            <select
              className="input"
              value={region}
              onChange={(e) => setRegion(e.target.value as AodpRegion)}
            >
              {REGION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field player-lookup__field player-lookup__field--ign">
            <span>Player IGN</span>
            <input
              type="search"
              className="input"
              value={ign}
              onChange={(e) => setIgn(e.target.value)}
              placeholder="Type in-game name..."
              autoComplete="off"
            />
          </label>
          <div className="player-lookup__action">
            <button type="submit" className="btn secondary" disabled={isSearching || isLoadingDetails}>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {error ? <p className="error-text">{error}</p> : null}

        {matches.length > 0 ? (
          <div className="player-lookup__matches">
            <h3 className="player-lookup__subhead">Matches</h3>
            <div className="player-lookup__match-list">
              {matches.map((match) => (
                <button
                  key={match.id}
                  type="button"
                  className={`player-lookup__match-btn${
                    selectedPlayerId === match.id ? ' is-active' : ''
                  }`}
                  onClick={() => void loadPlayerDetails(match.id)}
                >
                  <span className="player-lookup__match-name">{match.name}</span>
                  <span className="player-lookup__match-meta">
                    {match.guildName ?? 'No guild'}
                    {match.allianceName ? ` · ${match.allianceName}` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {isLoadingDetails ? <p className="hint">Loading player details...</p> : null}

        {profile ? (
          <div className="player-lookup__details">
            <section className="panel player-lookup__card player-lookup__profile">
              <h3 className="player-lookup__card-head">Overview</h3>
              <div className="player-lookup__profile-head">
                <h3>{profile.Name}</h3>
                {selectedMatch?.name && selectedMatch.name !== profile.Name ? (
                  <span className="muted">{selectedMatch.name}</span>
                ) : null}
              </div>
              <p className="player-lookup__meta">
                Guild: {profile.GuildName ?? 'None'} {profile.AllianceName ? `| Alliance: ${profile.AllianceName}` : ''}
              </p>
              <div className="player-lookup__stats-grid">
                <div className="player-lookup__stat">
                  <span>Kill Fame</span>
                  <strong>{formatNumber(asNumber(profile.KillFame))}</strong>
                </div>
                <div className="player-lookup__stat">
                  <span>Death Fame</span>
                  <strong>{formatNumber(asNumber(profile.DeathFame))}</strong>
                </div>
                <div className="player-lookup__stat">
                  <span>Fame Ratio</span>
                  <strong>{formatNumber(asNumber(profile.FameRatio))}</strong>
                </div>
                <div className="player-lookup__stat">
                  <span>PvE Fame</span>
                  <strong>{formatNumber(pveFame)}</strong>
                </div>
                <div className="player-lookup__stat">
                  <span>Gathering Fame</span>
                  <strong>{formatNumber(gatheringFame)}</strong>
                </div>
                <div className="player-lookup__stat">
                  <span>Crafting Fame</span>
                  <strong>{formatNumber(craftingFame)}</strong>
                </div>
              </div>
            </section>

            <section className="panel player-lookup__card">
              <h3 className="player-lookup__card-head">Player Details</h3>
              <div className="player-lookup__detail-grid">
                <div className="player-lookup__detail-item">
                  <span>Player ID</span>
                  <strong>{String(profile.Id ?? '-')}</strong>
                </div>
                <div className="player-lookup__detail-item">
                  <span>Guild ID</span>
                  <strong>{String(profile.GuildId || '-')}</strong>
                </div>
                <div className="player-lookup__detail-item">
                  <span>Alliance ID</span>
                  <strong>{String(profile.AllianceId || '-')}</strong>
                </div>
                <div className="player-lookup__detail-item">
                  <span>Avatar</span>
                  <strong>{String(profile.Avatar || '-')}</strong>
                </div>
                <div className="player-lookup__detail-item">
                  <span>Avatar Ring</span>
                  <strong>{String(profile.AvatarRing || '-')}</strong>
                </div>
                <div className="player-lookup__detail-item">
                  <span>Avg Item Power</span>
                  <strong>{formatNumber(asNumber(profile.AverageItemPower))}</strong>
                </div>
                <div className="player-lookup__detail-item">
                  <span>Fishing Fame</span>
                  <strong>{formatNumber(asNumber(stats.FishingFame))}</strong>
                </div>
                <div className="player-lookup__detail-item">
                  <span>Farming Fame</span>
                  <strong>{formatNumber(asNumber(stats.FarmingFame))}</strong>
                </div>
                <div className="player-lookup__detail-item">
                  <span>Crystal League</span>
                  <strong>{formatNumber(asNumber(stats.CrystalLeague))}</strong>
                </div>
              </div>
            </section>

            {guildHistory.length > 0 ? (
              <section className="panel player-lookup__card player-lookup__history">
                <h3 className="player-lookup__card-head">Guild History (from combat records)</h3>
                <ul className="player-lookup__history-list">
                  {guildHistory.map((row) => (
                    <li key={row.key} className="player-lookup__history-item">
                      <div className="player-lookup__history-main">
                        {row.guildName}
                        {row.allianceName ? ` | ${row.allianceName}` : ''}
                      </div>
                      <div className="player-lookup__history-meta">
                        Seen {row.appearances} times · First: {new Date(row.firstSeen).toLocaleDateString()} ·
                        Last: {new Date(row.lastSeen).toLocaleDateString()}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="panel player-lookup__card player-lookup__history">
              <h3 className="player-lookup__card-head">Lifetime Breakdown</h3>
              <div className="player-lookup__lifetime-grid">
                <div className="player-lookup__lifetime-card">
                  <div className="player-lookup__lifetime-title">PvE</div>
                  <div className="player-lookup__lifetime-row">Royal: {formatNumber(asNumber(pveStats?.Royal))}</div>
                  <div className="player-lookup__lifetime-row">
                    Outlands: {formatNumber(asNumber(pveStats?.Outlands))}
                  </div>
                  <div className="player-lookup__lifetime-row">Avalon: {formatNumber(asNumber(pveStats?.Avalon))}</div>
                  <div className="player-lookup__lifetime-row">
                    Hellgate: {formatNumber(asNumber(pveStats?.Hellgate))}
                  </div>
                  <div className="player-lookup__lifetime-row">
                    Corrupted: {formatNumber(asNumber(pveStats?.CorruptedDungeon))}
                  </div>
                  <div className="player-lookup__lifetime-row">Mists: {formatNumber(asNumber(pveStats?.Mists))}</div>
                </div>
                <div className="player-lookup__lifetime-card">
                  <div className="player-lookup__lifetime-title">Gathering</div>
                  <div className="player-lookup__lifetime-row">
                    Fiber: {formatNumber(asNumber(nestedStatsObject(gatheringStats ?? {}, 'Fiber')?.Total))}
                  </div>
                  <div className="player-lookup__lifetime-row">
                    Hide: {formatNumber(asNumber(nestedStatsObject(gatheringStats ?? {}, 'Hide')?.Total))}
                  </div>
                  <div className="player-lookup__lifetime-row">
                    Ore: {formatNumber(asNumber(nestedStatsObject(gatheringStats ?? {}, 'Ore')?.Total))}
                  </div>
                  <div className="player-lookup__lifetime-row">
                    Rock: {formatNumber(asNumber(nestedStatsObject(gatheringStats ?? {}, 'Rock')?.Total))}
                  </div>
                  <div className="player-lookup__lifetime-row">
                    Wood: {formatNumber(asNumber(nestedStatsObject(gatheringStats ?? {}, 'Wood')?.Total))}
                  </div>
                  <div className="player-lookup__lifetime-row">
                    All: {formatNumber(asNumber(nestedStatsObject(gatheringStats ?? {}, 'All')?.Total))}
                  </div>
                </div>
                <div className="player-lookup__lifetime-card">
                  <div className="player-lookup__lifetime-title">Crafting</div>
                  <div className="player-lookup__lifetime-row">
                    Royal: {formatNumber(asNumber(craftingStats?.Royal))}
                  </div>
                  <div className="player-lookup__lifetime-row">
                    Outlands: {formatNumber(asNumber(craftingStats?.Outlands))}
                  </div>
                  <div className="player-lookup__lifetime-row">
                    Avalon: {formatNumber(asNumber(craftingStats?.Avalon))}
                  </div>
                </div>
              </div>
            </section>

            <div className="player-lookup__event-grid">
              <section className="panel player-lookup__card player-lookup__events player-lookup__events--kills">
                <h3 className="player-lookup__card-head">Recent Kills</h3>
                {kills.length === 0 ? (
                  <p className="hint">No recent kills found.</p>
                ) : (
                  <ul className="player-lookup__event-list">
                    {kills.map((entry, idx) => (
                      <li key={`kill-${idx}`} className="player-lookup__event-item">
                        <div className="player-lookup__event-main">Victim: {eventVictimName(entry)}</div>
                        <div className="player-lookup__event-meta">
                          {eventTimestamp(entry)} · Fame: {formatNumber(eventFame(entry))}
                        </div>
                        {eventDetailsId(entry) ? (
                          <button
                            type="button"
                            className="btn secondary player-lookup__event-link"
                            onClick={() => {
                              const id = eventDetailsId(entry)
                              if (!id) return
                              setDetailRegion(region)
                              setDetailEventId(id)
                            }}
                          >
                            Show Details
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="panel player-lookup__card player-lookup__events player-lookup__events--deaths">
                <h3 className="player-lookup__card-head">Recent Deaths</h3>
                {deaths.length === 0 ? (
                  <p className="hint">No recent deaths found.</p>
                ) : (
                  <ul className="player-lookup__event-list">
                    {deaths.map((entry, idx) => (
                      <li key={`death-${idx}`} className="player-lookup__event-item">
                        <div className="player-lookup__event-main">Killed by: {pickKillerName(entry)}</div>
                        <div className="player-lookup__event-meta">
                          {eventTimestamp(entry)} · Fame lost: {formatNumber(eventFame(entry))}
                        </div>
                        {eventDetailsId(entry) ? (
                          <button
                            type="button"
                            className="btn secondary player-lookup__event-link"
                            onClick={() => {
                              const id = eventDetailsId(entry)
                              if (!id) return
                              setDetailRegion(region)
                              setDetailEventId(id)
                            }}
                          >
                            Show Details
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </section>
      {detailEventId ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setDetailEventId(null)}>
          <section
            ref={battleModalRef}
            className="modal-card modal-card--battle modal-card--autoscale"
            role="dialog"
            aria-modal="true"
            aria-label="Battle details"
            style={{ '--modal-scale': battleModalScale } as CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-card__head">
              <h3>Battle Details</h3>
              <button
                type="button"
                className="modal-close"
                aria-label="Close battle details"
                onClick={() => setDetailEventId(null)}
              >
                ×
              </button>
            </div>
            <BattleDetailsPage region={detailRegion} eventId={detailEventId} embedded />
          </section>
        </div>
      ) : null}
    </div>
  )
}
