import { useState } from 'react'
import { AppSidebar } from './AppSidebar'
import { CraftPlanner } from './CraftPlanner'
import { PlaceholderSection } from './PlaceholderSection'
import type { CraftPlannerKind, WorkshopSection } from './types'
import './App.css'

const CRAFT_SECTIONS: CraftPlannerKind[] = [
  'weapons',
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
]

function isCraftSection(s: WorkshopSection): s is CraftPlannerKind {
  return CRAFT_SECTIONS.includes(s as CraftPlannerKind)
}

function MainPanel({ section }: { section: WorkshopSection }) {
  if (isCraftSection(section)) {
    return <CraftPlanner kind={section} />
  }
  return <PlaceholderSection section={section} />
}

function App() {
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
