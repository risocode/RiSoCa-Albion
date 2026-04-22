import type { WorkshopSection } from './types'

const TITLES: Partial<Record<WorkshopSection, string>> = {
  head: 'Head',
  chest: 'Chest',
  boots: 'Boots',
  brewing: 'Brewing',
  refining_cloth: 'Refining · Cloth',
  refining_leather: 'Refining · Leather',
  refining_metal_bars: 'Refining · Metal Bars',
  refining_stone_block: 'Refining · Stone Block',
  refining_planks: 'Refining · Planks',
  brewing_heal: 'Brewing · Heal',
  brewing_energy: 'Brewing · Energy',
  brewing_gigantify: 'Brewing · Gigantify',
  brewing_resistance: 'Brewing · Resistance',
  brewing_sticky: 'Brewing · Sticky',
  brewing_poison: 'Brewing · Poison',
  brewing_invisibility: 'Brewing · Invisibility',
  brewing_calming: 'Brewing · Calming',
  brewing_cleansing: 'Brewing · Cleansing',
  brewing_acid: 'Brewing · Acid',
  brewing_berserk: 'Brewing · Berserk',
  brewing_hellfire: 'Brewing · Hellfire',
  brewing_gathering: 'Brewing · Gathering',
  brewing_tornado: 'Brewing · Tornado',
  brewing_focus: 'Brewing · Focus',
}

export function PlaceholderSection({ section }: { section: WorkshopSection }) {
  const title = TITLES[section] ?? section
  return (
    <div className="planner">
      <section className="panel panel--pick panel--placeholder">
        <p>
          <strong>{title}</strong> is not connected to recipe data in this build yet.
        </p>
        <p className="hint">Choose Weapons in the sidebar to use the crafting calculator.</p>
      </section>
    </div>
  )
}
