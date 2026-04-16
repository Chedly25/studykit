import { useExamProfile } from './useExamProfile'
import type { ProfileVertical } from '../db/schema'

/**
 * Active profile's vertical — drives shell/home/sidebar branching.
 * Defaults to 'generic' when no profile or the field is unset (pre-v37 rows).
 */
export function useProfileVertical() {
  const { activeProfile } = useExamProfile()
  const vertical = (activeProfile?.profileVertical ?? 'generic') as ProfileVertical
  return {
    vertical,
    isCRFPA: vertical === 'crfpa',
    isCPGE: vertical === 'cpge',
    isGeneric: vertical === 'generic',
  }
}
