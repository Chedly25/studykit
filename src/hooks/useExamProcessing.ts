/**
 * Hook wrapping exam exercise processing via the background job queue.
 */
import { useState, useCallback, useEffect } from 'react'
import * as Sentry from '@sentry/react'
import { toast } from 'sonner'
import { useSubscription } from './useSubscription'
import { useBackgroundJobs } from '../components/BackgroundJobsProvider'
import { useBackgroundJob } from './useBackgroundJob'

export function useExamProcessing(examProfileId: string | undefined) {
  const { isPro } = useSubscription()
  const { enqueue, cancel } = useBackgroundJobs()
  const [jobId, setJobId] = useState<string | null>(null)
  const { job, isRunning, isCompleted, isFailed, currentStepName, error } = useBackgroundJob(jobId)

  useEffect(() => {
    if (isFailed && error) {
      Sentry.captureException(new Error('[useExamProcessing] Processing failed: ' + String(error)))
      toast.error(`Exam processing failed: ${error}`)
    }
  }, [isFailed, error])

  const processExamDocument = useCallback(async (documentId: string) => {
    if (!examProfileId) return null
    if (!isPro) return null // AI processing is Pro only

    const id = await enqueue(
      'exam-exercise-processing',
      examProfileId,
      { documentId, isPro },
      3, // 3 steps: gather → parse+tag → save
    )
    setJobId(id)
    return id
  }, [examProfileId, isPro, enqueue])

  const cancelProcessing = useCallback(() => {
    if (jobId) cancel(jobId)
  }, [jobId, cancel])

  return {
    processExamDocument,
    cancel: cancelProcessing,
    isRunning,
    progress: job ? {
      currentStepName,
      completedSteps: job.completedStepCount,
      totalSteps: job.totalSteps,
    } : null,
    result: isCompleted ? { success: true } : isFailed ? { success: false } : null,
    error,
  }
}
