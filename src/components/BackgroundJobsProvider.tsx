/**
 * React context/provider for the background job queue + agent runner.
 * Instantiates the JobRunner and AgentRunner singletons and exposes them to the component tree.
 */
import { createContext, useContext, useRef, useEffect, useCallback } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { JobRunner } from '../ai/orchestrator/jobRunner'
import { AgentRunner } from '../ai/agents/runner'
import '../ai/agents/index' // Side-effect: registers all agents
import { useExamProfile } from '../hooks/useExamProfile'
import type { JobType } from '../db/schema'
import type { AgentId } from '../ai/agents/types'

interface BackgroundJobsContextValue {
  /** Enqueue a single workflow job. Returns the job ID. */
  enqueue(type: JobType, examProfileId: string, config: Record<string, unknown>, totalSteps: number): Promise<string>
  /** Enqueue a batch job (e.g., article review). Returns the job ID. */
  enqueueBatch(type: JobType, examProfileId: string, config: Record<string, unknown>, itemIds: string[], concurrency: number, totalStepsPerItem: number): Promise<string>
  /** Cancel a running or queued job. */
  cancel(jobId: string): Promise<void>
  /** Run a specific agent manually. */
  runAgent(agentId: AgentId, examProfileId: string): Promise<void>
}

const BackgroundJobsContext = createContext<BackgroundJobsContextValue | null>(null)

export function BackgroundJobsProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth()
  const { user } = useUser()
  const runnerRef = useRef<JobRunner | null>(null)
  const agentRunnerRef = useRef<AgentRunner | null>(null)

  // Stable reference to getToken that won't cause re-renders
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  // Create runners once
  if (!runnerRef.current) {
    runnerRef.current = new JobRunner(() => getTokenRef.current())
  }
  if (!agentRunnerRef.current) {
    agentRunnerRef.current = new AgentRunner(() => getTokenRef.current())
  }

  // Start job runner on mount (auto-resume interrupted jobs)
  useEffect(() => {
    runnerRef.current?.start()
  }, [])

  const { activeProfile } = useExamProfile()

  // Update agent runner and start scheduler when user + profile are available
  useEffect(() => {
    if (user?.id) {
      agentRunnerRef.current?.setUserId(user.id)
    }
    if (user?.id && activeProfile?.id) {
      agentRunnerRef.current?.startScheduler(activeProfile.id)
      // Fire app-open agents immediately
      agentRunnerRef.current?.runByTrigger('app-open', activeProfile.id)
    }
    return () => {
      agentRunnerRef.current?.stopScheduler()
    }
  }, [user?.id, activeProfile?.id])

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

  const runAgent = useCallback(
    async (agentId: AgentId, examProfileId: string) => {
      await agentRunnerRef.current?.run(agentId, examProfileId)
    },
    [],
  )

  return (
    <BackgroundJobsContext.Provider value={{ enqueue, enqueueBatch, cancel, runAgent }}>
      {children}
    </BackgroundJobsContext.Provider>
  )
}

export function useBackgroundJobs(): BackgroundJobsContextValue {
  const ctx = useContext(BackgroundJobsContext)
  if (!ctx) throw new Error('useBackgroundJobs must be used within BackgroundJobsProvider')
  return ctx
}
