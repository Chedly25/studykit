/**
 * Hook wrapping the source processing orchestrator workflow.
 */
import { useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useOrchestrator } from './useOrchestrator'
import { useSubscription } from './useSubscription'
import { createSourceProcessingWorkflow } from '../ai/workflows/sourceProcessing'

export function useSourceProcessing(examProfileId: string | undefined) {
  const { getToken } = useAuth()
  const { isPro } = useSubscription()
  const { run, cancel, isRunning, progress, result, error } = useOrchestrator<{
    summary: string
    conceptsFound: string[]
    mappingsApplied: number
    flashcardDeckId?: string
    flashcardCount?: number
  }>()

  const processDocument = useCallback(async (documentId: string) => {
    if (!examProfileId) return null

    const token = await getToken()
    if (!token) return null

    const workflow = createSourceProcessingWorkflow({
      documentId,
      isPro,
    })

    return run(workflow, { examProfileId, authToken: token })
  }, [examProfileId, getToken, isPro, run])

  return {
    processDocument,
    cancel,
    isRunning,
    progress,
    result,
    error,
  }
}
