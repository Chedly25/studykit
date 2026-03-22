/**
 * Hook wrapping source processing via the background job queue.
 * Processing survives navigation — progress is read from IndexedDB.
 */
import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useSubscription } from './useSubscription'
import { useBackgroundJobs } from '../components/BackgroundJobsProvider'
import { useBackgroundJob } from './useBackgroundJob'

export function useSourceProcessing(examProfileId: string | undefined) {
  const { isPro } = useSubscription()
  const { enqueue, cancel } = useBackgroundJobs()
  const [jobId, setJobId] = useState<string | null>(null)
  const { job, isRunning, isCompleted, isFailed, progress, currentStepName, error } = useBackgroundJob(jobId)

  // Show toast on job failure
  useEffect(() => {
    if (isFailed && error) {
      console.error('[useSourceProcessing] Processing failed:', error)
      toast.error(`Processing failed: ${error}`)
    }
  }, [isFailed, error])

  const processDocument = useCallback(async (documentId: string) => {
    if (!examProfileId) return null
    if (!isPro) return null // AI processing is Pro only

    const id = await enqueue(
      'source-processing',
      examProfileId,
      { documentId, isPro },
      4, // 4 steps: gather → parallel(embed+extract+flashcards) → save → concept cards
    )
    setJobId(id)
    return id
  }, [examProfileId, isPro, enqueue])

  const cancelProcessing = useCallback(() => {
    if (jobId) cancel(jobId)
  }, [jobId, cancel])

  return {
    processDocument,
    cancel: cancelProcessing,
    isRunning,
    progress: job ? {
      workflowName: 'Processing document',
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
