/**
 * Hook for tracking a single background job by ID.
 * Uses useLiveQuery for real-time updates from IndexedDB.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { BackgroundJob } from '../db/schema'

export interface BackgroundJobState {
  job: BackgroundJob | null
  isRunning: boolean
  isCompleted: boolean
  isFailed: boolean
  isCancelled: boolean
  progress: number // 0-1
  currentStepName: string
  error: string | null
  // Batch-specific
  batchTotal: number
  batchCompleted: number
  batchFailed: number
}

export function useBackgroundJob(jobId: string | null): BackgroundJobState {
  const job = useLiveQuery(
    () => jobId ? db.backgroundJobs.get(jobId) : undefined,
    [jobId],
  )

  if (!job) {
    return {
      job: null,
      isRunning: false,
      isCompleted: false,
      isFailed: false,
      isCancelled: false,
      progress: 0,
      currentStepName: '',
      error: null,
      batchTotal: 0,
      batchCompleted: 0,
      batchFailed: 0,
    }
  }

  const batchItemIds: string[] = job.batchItemIds ? JSON.parse(job.batchItemIds) : []
  const batchCompletedIds: string[] = job.batchCompletedIds ? JSON.parse(job.batchCompletedIds) : []
  const batchFailedIds: string[] = job.batchFailedIds ? JSON.parse(job.batchFailedIds) : []

  return {
    job,
    isRunning: job.status === 'running' || job.status === 'queued',
    isCompleted: job.status === 'completed',
    isFailed: job.status === 'failed',
    isCancelled: job.status === 'cancelled',
    progress: job.totalSteps > 0 ? job.completedStepCount / job.totalSteps : 0,
    currentStepName: job.currentStepName,
    error: job.error ?? null,
    batchTotal: batchItemIds.length,
    batchCompleted: batchCompletedIds.length,
    batchFailed: batchFailedIds.length,
  }
}
