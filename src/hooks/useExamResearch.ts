/**
 * Hook wrapping the exam research orchestrator workflow.
 */
import { useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useOrchestrator } from './useOrchestrator'
import { createExamResearchWorkflow } from '../ai/workflows/examResearch'

export function useExamResearch() {
  const { getToken } = useAuth()
  const { run, cancel, isRunning, progress, result, error } = useOrchestrator<{
    examIntelligence: string
    sectionsCreated: number
  }>()

  const researchExam = useCallback(async (
    examProfileId: string,
    profileName: string,
    examType: string,
  ) => {
    const token = await getToken()
    if (!token) return null

    const workflow = createExamResearchWorkflow({
      examProfileId,
      profileName,
      examType,
    })

    return run(workflow, { examProfileId, authToken: token })
  }, [getToken, run])

  return {
    researchExam,
    cancel,
    isRunning,
    progress,
    result,
    error,
  }
}
