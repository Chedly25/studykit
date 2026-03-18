/**
 * Hook wrapping exam research via the background job queue.
 * Processing survives navigation.
 */
import { useState, useCallback } from 'react'
import { useBackgroundJobs } from '../components/BackgroundJobsProvider'
import { useBackgroundJob } from './useBackgroundJob'

export function useExamResearch() {
  const { enqueue, cancel } = useBackgroundJobs()
  const [jobId, setJobId] = useState<string | null>(null)
  const { job, isRunning, isCompleted, isFailed, currentStepName, error } = useBackgroundJob(jobId)

  const researchExam = useCallback(async (
    examProfileId: string,
    profileName: string,
    examType: string,
  ) => {
    const id = await enqueue(
      'exam-research',
      examProfileId,
      { examProfileId, profileName, examType },
      4, // exam research workflow has ~4 steps
    )
    setJobId(id)
    return id
  }, [enqueue])

  return {
    researchExam,
    cancel: () => { if (jobId) cancel(jobId) },
    isRunning,
    progress: job ? {
      workflowName: 'Researching exam format',
      currentStepIndex: job.completedStepCount,
      totalSteps: job.totalSteps,
      currentStepName,
      completedSteps: job.completedStepCount,
      failedSteps: 0,
      isStreaming: false,
      streamedChars: 0,
    } : null,
    result: isCompleted ? { success: true } : isFailed ? { success: false } : null,
    error,
  }
}
