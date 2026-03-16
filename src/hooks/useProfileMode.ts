import { useExamProfile } from './useExamProfile'

export function useProfileMode() {
  const { activeProfile } = useExamProfile()
  const isResearch = activeProfile?.profileMode === 'research'
  return {
    isResearch,
    isStudy: !isResearch,
    mode: (activeProfile?.profileMode ?? 'study') as 'study' | 'research',
  }
}
