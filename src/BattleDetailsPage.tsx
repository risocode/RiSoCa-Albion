import { useEffect, useMemo, useState } from 'react'
import { ItemIcon } from './ItemIcon'
import { fetchEventDetails, type EventActor, type EventDetails, type EventItem } from './gameInfo'
import { summarizeItemHoverLabel } from './formatItemName'
import type { AodpRegion } from './types'

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatNumber(value: unknown): string {
  const n = asNumber(value)
  return n == null ? '-' : n.toLocaleString()
}

function formatWholeNumber(value: unknown): string {
  const n = asNumber(value)
  return n == null ? '-' : Math.round(n).toLocaleString()
}

function formatTime(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function actorName(actor: EventActor | null | undefined, fallback: string): string {
  const name = actor?.Name
  return typeof name === 'string' && name.trim().length > 0 ? name : fallback
}

function isTwoHandWeapon(type: string | undefined): boolean {
  if (!type) return false
  return /(^|_)2H(_|$)/i.test(type)
}

const EQUIPMENT_LAYOUT = [
  'Bag',
  'Head',
  'Cape',
  'MainHand',
  'Armor',
  'OffHand',
  'Potion',
  'Shoes',
  'Food',
  null,
  'Mount',
  null,
] as const

function EquipmentGrid({
  actor,
  title,
}: {
  actor: EventActor | null | undefined
  title: string
}) {
  const equipment = actor?.Equipment ?? {}
  const mainHand = equipment.MainHand
  const mainHandType = typeof mainHand?.Type === 'string' ? mainHand.Type : ''
  const hasTwoHandMain = isTwoHandWeapon(mainHandType)
  return (
    <section className="panel battle-details__card">
      <h3 className="battle-details__subhead">{title}</h3>
      <div className="battle-details__equip-grid">
        {EQUIPMENT_LAYOUT.map((slot, idx) => {
          if (!slot) {
            return <div key={`empty-${idx}`} className="battle-details__equip-spacer" aria-hidden />
          }
          const item = equipment[slot]
          const itemType = typeof item?.Type === 'string' ? item.Type : ''
          const showsTwoHandGhost = slot === 'OffHand' && !itemType && hasTwoHandMain && !!mainHandType
          const displayType = showsTwoHandGhost ? mainHandType : itemType
          const iconClass = showsTwoHandGhost
            ? 'item-icon--list battle-details__equip-icon--ghost'
            : 'item-icon--list'
          return (
            <div key={slot} className="battle-details__equip-item">
              {displayType ? (
                <>
                  <ItemIcon
                    uniqueName={displayType}
                    localFolder="resources"
                    size={44}
                    className={iconClass}
                    hoverLabel={summarizeItemHoverLabel(displayType)}
                  />
                </>
              ) : (
                <>
                  <div className="battle-details__equip-empty" />
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function InventoryGrid({
  items,
  title,
}: {
  items: EventItem[] | undefined
  title: string
}) {
  const inventory = Array.isArray(items) ? items.filter((it) => typeof it?.Type === 'string' && it.Type) : []
  return (
    <section className="panel battle-details__card">
      <h3 className="battle-details__subhead">{title}</h3>
      {inventory.length === 0 ? (
        <p className="hint">No items found.</p>
      ) : (
        <div className="battle-details__inventory-grid">
          {inventory.map((item, idx) => (
            <div key={`${item.Type}-${idx}`} className="battle-details__inventory-item">
              <ItemIcon
                uniqueName={item.Type as string}
                localFolder="resources"
                size={34}
                className="item-icon--list"
                hoverLabel={summarizeItemHoverLabel(item.Type as string)}
              />
              <div className="battle-details__inventory-count">{formatNumber(item.Count)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function BattleDetailsPage({
  region,
  eventId,
  embedded = false,
}: {
  region: AodpRegion
  eventId: string
  embedded?: boolean
}) {
  const [data, setData] = useState<EventDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const details = await fetchEventDetails(region, eventId)
        if (!cancelled) {
          setData(details)
        }
      } catch (e) {
        if (!cancelled) {
          setData(null)
          setError(e instanceof Error ? e.message : 'Failed to load battle details.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [region, eventId])

  const participants = useMemo(() => {
    if (!data) return []
    return Array.isArray(data.Participants) ? data.Participants : []
  }, [data])

  if (loading) {
    const loadingBody = (
      <section className={embedded ? 'battle-details__page battle-details__page--embedded' : 'panel battle-details__page'}>
        <p className="hint">Loading battle details…</p>
      </section>
    )
    if (embedded) return loadingBody
    return (
      <div className="planner">
        {loadingBody}
      </div>
    )
  }

  if (error || !data) {
    const errorBody = (
      <section className={embedded ? 'battle-details__page battle-details__page--embedded' : 'panel battle-details__page'}>
        <p className="error-text">{error ?? 'No battle data found.'}</p>
        {!embedded ? (
          <a className="btn secondary" href="/">
            Back to app
          </a>
        ) : null}
      </section>
    )
    if (embedded) return errorBody
    return (
      <div className="planner">
        {errorBody}
      </div>
    )
  }

  const killer = data.Killer
  const victim = data.Victim
  const content = (
    <section className={embedded ? 'battle-details__page battle-details__page--embedded' : 'panel battle-details__page'}>
        <div className="battle-details__head">
          <div className="battle-details__versus">
            <div className="battle-details__fighter">
              <div className="battle-details__label">Killer</div>
              <div className="battle-details__name">{actorName(killer, 'Unknown')}</div>
              <div className="battle-details__meta">IP: {formatWholeNumber(killer?.AverageItemPower)}</div>
            </div>
            <div className="battle-details__vs">VS</div>
            <div className="battle-details__fighter battle-details__fighter--victim">
              <div className="battle-details__label">Victim</div>
              <div className="battle-details__name">{actorName(victim, 'Unknown')}</div>
              <div className="battle-details__meta">IP: {formatWholeNumber(victim?.AverageItemPower)}</div>
            </div>
          </div>
          <div className="battle-details__stats">
            <div>
              <strong>{formatNumber(data.TotalVictimKillFame)}</strong>
              <span>Total Fame</span>
            </div>
            <div>
              <strong>{formatTime(data.TimeStamp)}</strong>
              <span>Time</span>
            </div>
            <div>
              <strong>{String(data.EventId ?? eventId)}</strong>
              <span>Event ID</span>
            </div>
          </div>
        </div>

        <div className="battle-details__grid">
          <EquipmentGrid actor={killer} title="Killer Gear" />
          <EquipmentGrid actor={victim} title="Victim Gear" />
          <section className="panel battle-details__card">
            <h3 className="battle-details__subhead">Kill Participants</h3>
            {participants.length === 0 ? (
              <p className="hint">No participant details available.</p>
            ) : (
              <ul className="battle-details__participant-list">
                {participants.map((p, idx) => (
                  <li key={`${p.Id ?? p.Name ?? idx}`} className="battle-details__participant-item">
                    <span>{actorName(p, 'Unknown')}</span>
                    <strong>{formatNumber(p.KillFame)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <InventoryGrid items={victim?.Inventory} title="Victim Inventory" />
        </div>
      </section>
  )

  if (embedded) return content
  return (
    <div className="planner">
      {content}
    </div>
  )
}
