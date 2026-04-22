import { useId, useState } from 'react'
import { ItemIcon } from './ItemIcon'
import type { WorkshopSection } from './types'

type NavItem = {
  id: WorkshopSection
  label: string
  icon?: string
  iconSrc?: string
  iconItemId?: string
}

type NavGroup = {
  id: 'crafting' | 'refining' | 'brewing'
  label: string
  items: NavItem[]
}

const GROUPS: NavGroup[] = [
  {
    id: 'crafting',
    label: 'Crafting',
    items: [
      { id: 'weapons', label: 'Weapon', icon: '⚔', iconSrc: '/weapon.png' },
      { id: 'head', label: 'Head', icon: '⛑', iconSrc: '/head.png' },
      { id: 'chest', label: 'Chest', icon: '🦺', iconSrc: '/chests.png' },
      { id: 'boots', label: 'Boots', icon: '👢', iconSrc: '/boots.png' },
    ],
  },
  {
    id: 'refining',
    label: 'Refining',
    items: [
      { id: 'refining_cloth', label: 'Cloth', iconItemId: 'T8_CLOTH' },
      { id: 'refining_leather', label: 'Leather', iconItemId: 'T8_LEATHER' },
      { id: 'refining_metal_bars', label: 'Metal Bars', iconItemId: 'T8_METALBAR' },
      { id: 'refining_stone_block', label: 'Stone Block', iconItemId: 'T8_STONEBLOCK' },
      { id: 'refining_planks', label: 'Planks', iconItemId: 'T8_PLANKS' },
    ],
  },
  {
    id: 'brewing',
    label: 'Alchemist Lab',
    items: [
      { id: 'brewing_heal', label: 'Heal', iconItemId: 'T6_POTION_HEAL' },
      { id: 'brewing_energy', label: 'Energy', iconItemId: 'T6_POTION_ENERGY' },
      { id: 'brewing_gigantify', label: 'Gigantify', iconItemId: 'T7_POTION_REVIVE' },
      { id: 'brewing_resistance', label: 'Resistance', iconItemId: 'T7_POTION_STONESKIN' },
      { id: 'brewing_sticky', label: 'Sticky', iconItemId: 'T7_POTION_SLOWFIELD' },
      { id: 'brewing_poison', label: 'Poison', iconItemId: 'T8_POTION_COOLDOWN' },
      { id: 'brewing_invisibility', label: 'Invisibility', iconItemId: 'T8_POTION_CLEANSE' },
      { id: 'brewing_calming', label: 'Calming', iconItemId: 'T7_POTION_MOB_RESET' },
      { id: 'brewing_cleansing', label: 'Cleansing', iconItemId: 'T7_POTION_CLEANSE2' },
      { id: 'brewing_acid', label: 'Acid', iconItemId: 'T7_POTION_ACID' },
      { id: 'brewing_berserk', label: 'Berserk', iconItemId: 'T8_POTION_BERSERK' },
      { id: 'brewing_hellfire', label: 'Hellfire', iconItemId: 'T8_POTION_LAVA' },
      { id: 'brewing_gathering', label: 'Gathering', iconItemId: 'T8_POTION_GATHER' },
      { id: 'brewing_tornado', label: 'Tornado', iconItemId: 'T8_POTION_TORNADO' },
      { id: 'brewing_focus', label: 'Focus', iconItemId: 'T8_FOCUSPOTION_NONTRADABLE' },
    ],
  },
]

type AppSidebarProps = {
  activeSection: WorkshopSection
  onNavigate: (section: WorkshopSection) => void
}

export function AppSidebar({ activeSection, onNavigate }: AppSidebarProps) {
  const gradId = useId().replace(/:/g, '')
  const [openGroup, setOpenGroup] = useState<NavGroup['id'] | null>(null)

  return (
    <aside className="app-sidebar" aria-label="Application menu">
      <div className="sidebar-brand">
        <div className="sidebar-brand__mark" aria-hidden>
          <svg className="sidebar-brand__svg" viewBox="0 0 56 56" fill="none">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e8c547" />
                <stop offset="55%" stopColor="#b8942e" />
                <stop offset="100%" stopColor="#6b5218" />
              </linearGradient>
            </defs>
            <path
              d="M28 2L52 14v28L28 54 4 42V14L28 2z"
              stroke={`url(#${gradId})`}
              strokeWidth="1.5"
              fill="rgba(212,175,55,0.06)"
            />
            <path
              d="M28 14v20M18 24h20"
              stroke={`url(#${gradId})`}
              strokeWidth="2"
              strokeLinecap="square"
            />
          </svg>
        </div>
        <div className="sidebar-brand__text">
          <span className="sidebar-brand__title">SoCaRi</span>
          <span className="sidebar-brand__subtitle">Albion Tool</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Sections">
        <div className="sidebar-nav__section">Workshop</div>
        {GROUPS.map((group) => {
          const isOpen = openGroup === group.id
          return (
            <section key={group.id} className="sidebar-group">
              <button
                type="button"
                className={`sidebar-group__toggle${isOpen ? ' is-open' : ''}`}
                aria-expanded={isOpen}
                onClick={() => setOpenGroup((prev) => (prev === group.id ? null : group.id))}
              >
                <span className="sidebar-group__title">{group.label}</span>
                <span className="sidebar-group__chevron" aria-hidden>
                  {isOpen ? '▾' : '▸'}
                </span>
              </button>
              {isOpen ? (
                <div className="sidebar-group__items">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`sidebar-nav__item sidebar-nav__item--child${
                        activeSection === item.id ? ' is-active' : ''
                      }`}
                      aria-current={activeSection === item.id ? 'page' : undefined}
                      onClick={() => onNavigate(item.id)}
                    >
                      <span className="sidebar-nav__icon" aria-hidden>
                        {item.iconSrc ? (
                          <img
                            src={item.iconSrc}
                            alt=""
                            className="sidebar-nav__icon-img"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : item.iconItemId ? (
                          <ItemIcon
                            uniqueName={item.iconItemId}
                            localFolder={group.id === 'brewing' ? 'alchemist' : 'resources'}
                            size={20}
                            className="sidebar-nav__icon-item"
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          item.icon ?? '•'
                        )}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-footer__line">Unofficial fan tool</span>
        <span className="sidebar-footer__line">Recipes from ao-bin-dumps</span>
      </div>
    </aside>
  )
}
