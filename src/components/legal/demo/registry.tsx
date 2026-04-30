/**
 * Registry mapping CoachKind → its demo component.
 * Used by CoachPageHeader to render the Découvrir button conditionally
 * (only for coaches that have a demo authored).
 *
 * Add a new coach demo by importing its top-level component and registering
 * it here.
 */
import type { ComponentType } from 'react'
import type { CoachKind } from '../../../data/coachPrimers'
import { SyllogismeDemo } from './SyllogismeDemo'
import { FicheDemo } from './FicheDemo'
import { PlanDemo } from './PlanDemo'

export interface CoachDemoProps {
  onClose: () => void
  onStartReal: () => void
}

export const COACH_DEMOS: Partial<Record<CoachKind, ComponentType<CoachDemoProps>>> = {
  syllogisme: SyllogismeDemo,
  fiche: FicheDemo,
  plan: PlanDemo,
}
