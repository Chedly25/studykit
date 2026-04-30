/**
 * Top-level wrapper for the Fiche d'arrêt feature demo.
 */
import { FeatureDemoPlayer } from './FeatureDemoPlayer'
import { FicheDemoBody } from './FicheDemoBody'
import { useDemoRunner } from './useDemoRunner'
import {
  FICHE_DEMO_INITIAL,
  FICHE_DEMO_FINAL,
  FICHE_DEMO_STEPS,
  FICHE_DEMO_DURATION_MS,
  applyFicheType,
} from '../../../data/coachDemos/ficheDemo'

interface Props {
  onClose: () => void
  onStartReal: () => void
}

export function FicheDemo({ onClose, onStartReal }: Props) {
  const { state, caption, controls } = useDemoRunner({
    initialState: FICHE_DEMO_INITIAL,
    finalState: FICHE_DEMO_FINAL,
    steps: FICHE_DEMO_STEPS,
    estimatedDurationMs: FICHE_DEMO_DURATION_MS,
    applyType: applyFicheType,
  })

  return (
    <FeatureDemoPlayer
      title="Fiche d'arrêt"
      subtitle="Lire une décision en cinq sections."
      caption={caption}
      controls={controls}
      onClose={onClose}
      onStartReal={onStartReal}
    >
      <FicheDemoBody state={state} />
    </FeatureDemoPlayer>
  )
}
