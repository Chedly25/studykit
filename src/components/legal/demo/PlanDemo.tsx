/**
 * Top-level wrapper for the Plan détaillé feature demo.
 */
import { FeatureDemoPlayer } from './FeatureDemoPlayer'
import { PlanDemoBody } from './PlanDemoBody'
import { useDemoRunner } from './useDemoRunner'
import {
  PLAN_DEMO_INITIAL,
  PLAN_DEMO_FINAL,
  PLAN_DEMO_STEPS,
  PLAN_DEMO_DURATION_MS,
  applyPlanType,
} from '../../../data/coachDemos/planDemo'

interface Props {
  onClose: () => void
  onStartReal: () => void
}

export function PlanDemo({ onClose, onStartReal }: Props) {
  const { state, caption, controls } = useDemoRunner({
    initialState: PLAN_DEMO_INITIAL,
    finalState: PLAN_DEMO_FINAL,
    steps: PLAN_DEMO_STEPS,
    estimatedDurationMs: PLAN_DEMO_DURATION_MS,
    applyType: applyPlanType,
  })

  return (
    <FeatureDemoPlayer
      title="Plan détaillé"
      subtitle="L'épine dorsale d'une dissertation."
      caption={caption}
      controls={controls}
      onClose={onClose}
      onStartReal={onStartReal}
    >
      <PlanDemoBody state={state} />
    </FeatureDemoPlayer>
  )
}
