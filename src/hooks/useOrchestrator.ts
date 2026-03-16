/**
 * React hook wrapping the orchestrator engine.
 * Provides progress tracking, cancellation, and result state.
 */
import { useState, useRef, useCallback } from 'react'
import { runWorkflow, type RunWorkflowConfig } from '../ai/orchestrator/engine'
import type { WorkflowDefinition, WorkflowProgress, WorkflowResult } from '../ai/orchestrator/types'

export function useOrchestrator<T>() {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<WorkflowProgress | null>(null)
  const [result, setResult] = useState<WorkflowResult<T> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async (
    workflow: WorkflowDefinition<T>,
    config: Omit<RunWorkflowConfig, 'signal'>,
  ): Promise<WorkflowResult<T> | null> => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsRunning(true)
    setProgress(null)
    setResult(null)
    setError(null)

    try {
      const workflowResult = await runWorkflow<T>(
        workflow,
        { ...config, signal: controller.signal },
        { onProgress: setProgress },
      )
      setResult(workflowResult)
      if (!workflowResult.success) {
        // Find the failed step
        const failedStep = Object.entries(workflowResult.stepResults).find(
          ([, r]) => r.status === 'failed',
        )
        setError(failedStep ? `Step failed: ${failedStep[1].error}` : 'Workflow failed')
      }
      return workflowResult
    } catch (err) {
      if (controller.signal.aborted) {
        setError('Cancelled')
      } else {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
      }
      return null
    } finally {
      setIsRunning(false)
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { run, cancel, isRunning, progress, result, error }
}
