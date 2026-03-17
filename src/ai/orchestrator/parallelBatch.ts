/**
 * Parallel batch runner — bounded-concurrency execution of workflows.
 * Uses semaphore pattern: maintain Set<Promise> of active tasks, Promise.race() to wait for a slot.
 */
import { runWorkflow, type RunWorkflowConfig } from './engine'
import type { WorkflowDefinition, WorkflowProgress, WorkflowResult } from './types'

export type ItemStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface BatchItem<T> {
  id: string
  data: T
}

export interface BatchItemState {
  status: ItemStatus
  workflowProgress?: WorkflowProgress
  error?: string
}

export interface BatchProgress {
  totalItems: number
  completedItems: number
  failedItems: number
  runningItems: number
  items: Map<string, BatchItemState>
  elapsedMs: number
}

export interface BatchConfig {
  concurrency: number
  examProfileId: string
  authToken: string
  signal?: AbortSignal
}

export interface BatchResult<TResult> {
  results: Map<string, WorkflowResult<TResult>>
  successCount: number
  failureCount: number
}

export async function runParallelBatch<TItem, TResult>(
  items: BatchItem<TItem>[],
  workflowFactory: (item: TItem, itemId: string) => WorkflowDefinition<TResult>,
  config: BatchConfig,
  callbacks?: { onProgress?: (progress: BatchProgress) => void },
): Promise<BatchResult<TResult>> {
  const startTime = Date.now()
  const results = new Map<string, WorkflowResult<TResult>>()
  const itemStates = new Map<string, BatchItemState>()
  let successCount = 0
  let failureCount = 0

  // Initialize all items as queued
  for (const item of items) {
    itemStates.set(item.id, { status: 'queued' })
  }

  function emitProgress() {
    const running = [...itemStates.values()].filter(s => s.status === 'running').length
    callbacks?.onProgress?.({
      totalItems: items.length,
      completedItems: successCount + failureCount,
      failedItems: failureCount,
      runningItems: running,
      items: new Map(itemStates),
      elapsedMs: Date.now() - startTime,
    })
  }

  emitProgress()

  // Worker pool — each worker drains from the shared queue
  const queue = [...items]

  async function worker() {
    while (queue.length > 0) {
      if (config.signal?.aborted) return
      const item = queue.shift()!

      const id = item.id
      itemStates.set(id, { status: 'running' })
      emitProgress()

      const workflow = workflowFactory(item.data, id)
      const runConfig: RunWorkflowConfig = {
        examProfileId: config.examProfileId,
        authToken: config.authToken,
        signal: config.signal,
      }

      try {
        const result = await runWorkflow<TResult>(workflow, runConfig, {
          onProgress(wp) {
            itemStates.set(id, { status: 'running', workflowProgress: wp })
            emitProgress()
          },
        })

        results.set(id, result)
        if (result.success) {
          successCount++
          itemStates.set(id, { status: 'completed' })
        } else {
          failureCount++
          const failedStep = Object.entries(result.stepResults).find(([, r]) => r.status === 'failed')
          itemStates.set(id, { status: 'failed', error: failedStep?.[1].error ?? 'Workflow failed' })
        }
      } catch (err) {
        failureCount++
        itemStates.set(id, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }

      emitProgress()
    }
  }

  const workerCount = Math.min(config.concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return { results, successCount, failureCount }
}
