/**
 * React context/provider for the background job queue.
 * Instantiates the JobRunner singleton and exposes enqueue/cancel to the component tree.
 */
import { createContext, useContext, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { JobRunner } from '../ai/orchestrator/jobRunner'
import type { JobType } from '../db/schema'

interface BackgroundJobsContextValue {
  /** Enqueue a single workflow job. Returns the job ID. */
  enqueue(type: JobType, examProfileId: string, config: Record<string, unknown>, totalSteps: number): Promise<string>
  /** Enqueue a batch job (e.g., article review). Returns the job ID. */
  enqueueBatch(type: JobType, examProfileId: string, config: Record<string, unknown>, itemIds: string[], concurrency: number, totalStepsPerItem: number): Promise<string>
  /** Cancel a running or queued job. */
  cancel(jobId: string): Promise<void>
}

const BackgroundJobsContext = createContext<BackgroundJobsContextValue | null>(null)

export function BackgroundJobsProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth()
  const runnerRef = useRef<JobRunner | null>(null)

  // Stable reference to getToken that won't cause re-renders
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  // Create runner once
  if (!runnerRef.current) {
    runnerRef.current = new JobRunner(() => getTokenRef.current())
  }

  // Start on mount (auto-resume interrupted jobs)
  useEffect(() => {
    runnerRef.current?.start()
  }, [])

  const enqueue = useCallback(
    (type: JobType, examProfileId: string, config: Record<string, unknown>, totalSteps: number) =>
      runnerRef.current!.enqueue(type, examProfileId, config, totalSteps),
    [],
  )

  const enqueueBatch = useCallback(
    (type: JobType, examProfileId: string, config: Record<string, unknown>, itemIds: string[], concurrency: number, totalStepsPerItem: number) =>
      runnerRef.current!.enqueueBatch(type, examProfileId, config, itemIds, concurrency, totalStepsPerItem),
    [],
  )

  const cancel = useCallback(
    (jobId: string) => runnerRef.current!.cancel(jobId),
    [],
  )

  return (
    <BackgroundJobsContext.Provider value={{ enqueue, enqueueBatch, cancel }}>
      {children}
    </BackgroundJobsContext.Provider>
  )
}

export function useBackgroundJobs(): BackgroundJobsContextValue {
  const ctx = useContext(BackgroundJobsContext)
  if (!ctx) throw new Error('useBackgroundJobs must be used within BackgroundJobsProvider')
  return ctx
}
