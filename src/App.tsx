import { useState } from 'react'
import { AppSidebar } from './AppSidebar'
import { BattleDetailsPage } from './BattleDetailsPage'
import { CraftPlanner } from './CraftPlanner'
import { PlayerLookupPanel } from './PlayerLookupPanel'
import { PlaceholderSection } from './PlaceholderSection'
import type { AodpRegion, CraftPlannerKind, WorkshopSection } from './types'
import './App.css'

const CRAFT_SECTIONS: CraftPlannerKind[] = [
  'weapons',
  'offhands',
  'head',
  'chest',
  'boots',
  'refining_cloth',
  'refining_leather',
  'refining_metal_bars',
  'refining_stone_block',
  'refining_planks',
  'brewing_heal',
  'brewing_energy',
  'brewing_gigantify',
  'brewing_resistance',
  'brewing_sticky',
  'brewing_poison',
  'brewing_invisibility',
  'brewing_calming',
  'brewing_cleansing',
  'brewing_acid',
  'brewing_berserk',
  'brewing_hellfire',
  'brewing_gathering',
  'brewing_tornado',
  'brewing_focus',
  'cooking_stews',
  'cooking_soups',
  'cooking_salads',
  'cooking_sandwiches',
  'cooking_pies',
  'cooking_omelettes',
  'cooking_roasts',
  'cooking_grilledfish',
]

function isCraftSection(s: WorkshopSection): s is CraftPlannerKind {
  return CRAFT_SECTIONS.includes(s as CraftPlannerKind)
}

function MainPanel({ section }: { section: WorkshopSection }) {
  if (section === 'player_lookup') {
    return <PlayerLookupPanel />
  }
  if (isCraftSection(section)) {
    return <CraftPlanner kind={section} />
  }
  return <PlaceholderSection section={section} />
}

function App() {
  const params = new URLSearchParams(window.location.search)
  const battleEvent = params.get('battleEvent')
  const battleRegionRaw = params.get('battleRegion')
  const battleRegion: AodpRegion =
    battleRegionRaw === 'asia' || battleRegionRaw === 'americas' || battleRegionRaw === 'europe'
      ? battleRegionRaw
      : 'asia'
  if (battleEvent && battleEvent.trim().length > 0) {
    return <BattleDetailsPage region={battleRegion} eventId={battleEvent.trim()} />
  }

  const [section, setSection] = useState<WorkshopSection>('weapons')

  return (
    <div className="app-layout">
      <AppSidebar activeSection={section} onNavigate={setSection} />
      <main className="app-main">
        <div className="app-main__inner">
          <MainPanel section={section} />
        </div>
      </main>
    </div>
  )
}

export default App
