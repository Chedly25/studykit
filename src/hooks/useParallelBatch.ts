/**
 * React hook wrapping the parallel batch runner.
 * Provides progress tracking, cancellation, and result state.
 */
import { useState, useRef, useCallback } from 'react'
import {
  runParallelBatch,
  type BatchItem,
  type BatchProgress,
  type BatchResult,
  type BatchConfig,
} from '../ai/orchestrator/parallelBatch'
import type { WorkflowDefinition } from '../ai/orchestrator/types'

export function useParallelBatch<TItem, TResult>() {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<BatchProgress | null>(null)
  const [result, setResult] = useState<BatchResult<TResult> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async (
    items: BatchItem<TItem>[],
    workflowFactory: (item: TItem, itemId: string) => WorkflowDefinition<TResult>,
    config: Omit<BatchConfig, 'signal'>,
  ): Promise<BatchResult<TResult> | null> => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsRunning(true)
    setProgress(null)
    setResult(null)
    setError(null)

    try {
      const batchResult = await runParallelBatch<TItem, TResult>(
        items,
        workflowFactory,
        { ...config, signal: controller.signal },
        { onProgress: setProgress },
      )
      setResult(batchResult)
      if (batchResult.failureCount > 0 && batchResult.successCount === 0) {
        setError('All articles failed processing')
      }
      return batchResult
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
