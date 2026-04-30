/**
 * Top-level wrapper for the Syllogisme feature demo. Owns the demo runner
 * and renders the player + the coach-specific demo body.
 */
import { FeatureDemoPlayer } from './FeatureDemoPlayer'
import { SyllogismeDemoBody } from './SyllogismeDemoBody'
import { useDemoRunner } from './useDemoRunner'
import {
  SYLLOGISME_DEMO_INITIAL,
  SYLLOGISME_DEMO_FINAL,
  SYLLOGISME_DEMO_STEPS,
  SYLLOGISME_DEMO_DURATION_MS,
  applySyllogismeType,
} from '../../../data/coachDemos/syllogismeDemo'

interface Props {
  onClose: () => void
  onStartReal: () => void
}

export function SyllogismeDemo({ onClose, onStartReal }: Props) {
  const { state, caption, controls } = useDemoRunner({
    initialState: SYLLOGISME_DEMO_INITIAL,
    finalState: SYLLOGISME_DEMO_FINAL,
    steps: SYLLOGISME_DEMO_STEPS,
    estimatedDurationMs: SYLLOGISME_DEMO_DURATION_MS,
    applyType: applySyllogismeType,
  })

  return (
    <FeatureDemoPlayer
      title="Syllogisme"
      subtitle="Le raisonnement juridique en trois temps"
      caption={caption}
      controls={controls}
      onClose={onClose}
      onStartReal={onStartReal}
    >
      <SyllogismeDemoBody state={state} />
    </FeatureDemoPlayer>
  )
}
