/**
 * JobRunner — persistent background job queue processor.
 *
 * A plain TypeScript singleton (not a React component) that:
 * - Stores jobs in IndexedDB (survives navigation + page refresh)
 * - Checkpoints after each workflow step (resume from where it left off)
 * - Refreshes auth tokens before each step
 * - Processes batch jobs with bounded concurrency
 */
import * as Sentry from '@sentry/react'
import { db } from '../../db'
import type { BackgroundJob, JobType, JobStatus } from '../../db/schema'
import type { WorkflowContext, WorkflowDefinition, StepResult } from './types'
import { callFastModel } from '../fastClient'
import { hybridSearch } from '../../lib/hybridSearch'
import { searchWeb as searchWebClient } from '../tools/webSearchTool'
import { reconstructWorkflow, reconstructArticleWorkflow } from './jobTypes'

export class JobRunner {
  private getToken: () => Promise<string | null>
  private abortControllers = new Map<string, AbortController>()
  private activeJobs = 0
  private processingQueue = false
  private readonly maxConcurrency = 2

  constructor(getToken: () => Promise<string | null>) {
    this.getToken = getToken
  }

  /** Call once on app startup. Resets interrupted jobs and starts processing. */
  async start(): Promise<void> {
    // Reset any jobs left in 'running' state (interrupted by page close)
    const interrupted = await db.backgroundJobs
      .where('status').equals('running')
      .toArray()
    for (const job of interrupted) {
      await db.backgroundJobs.update(job.id, {
        status: 'queued' as JobStatus,
        updatedAt: new Date().toISOString(),
      })
    }
    this.processQueue()
  }

  /** Enqueue a single workflow job. Returns the job ID. */
  async enqueue(
    type: JobType,
    examProfileId: string,
    config: Record<string, unknown>,
    totalSteps: number,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await db.backgroundJobs.put({
      id,
      examProfileId,
      type,
      status: 'queued',
      config: JSON.stringify(config),
      completedStepIds: '[]',
      stepResults: '{}',
      totalSteps,
      completedStepCount: 0,
      currentStepName: '',
      createdAt: now,
      updatedAt: now,
    })
    this.processQueue()
    return id
  }

  /** Enqueue a batch job (e.g., article review with N items). Returns the job ID. */
  async enqueueBatch(
    type: JobType,
    examProfileId: string,
    config: Record<string, unknown>,
    itemIds: string[],
    concurrency: number,
    totalStepsPerItem: number,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await db.backgroundJobs.put({
      id,
      examProfileId,
      type,
      status: 'queued',
      config: JSON.stringify(config),
      completedStepIds: '[]',
      stepResults: '{}',
      totalSteps: itemIds.length * totalStepsPerItem,
      completedStepCount: 0,
      currentStepName: '',
      batchItemIds: JSON.stringify(itemIds),
      batchCompletedIds: '[]',
      batchFailedIds: '[]',
      batchConcurrency: concurrency,
      createdAt: now,
      updatedAt: now,
    })
    this.processQueue()
    return id
  }

  /** Cancel a running or queued job. */
  async cancel(jobId: string): Promise<void> {
    const controller = this.abortControllers.get(jobId)
    if (controller) controller.abort()
    await db.backgroundJobs.update(jobId, {
      status: 'cancelled' as JobStatus,
      updatedAt: new Date().toISOString(),
    })
  }

  // ─── Queue Processing ─────────────────────────────────────────

  private async processQueue(): Promise<void> {
    if (this.processingQueue) return
    this.processingQueue = true
    try {
    while (this.activeJobs < this.maxConcurrency) {
      // Pick oldest queued job
      const job = await db.backgroundJobs
        .where('status').equals('queued')
        .sortBy('createdAt')
        .then(jobs => jobs[0])

      if (!job) break

      // Optimistic lock: atomically set to 'running'
      const modified = await db.backgroundJobs
        .where('id').equals(job.id)
        .and(j => j.status === 'queued')
        .modify({ status: 'running', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

      if (modified === 0) continue // Another tab got it

      this.activeJobs++

      // Fire and forget — run the job, then check for more work
      ;(async () => {
        try {
          if (job.batchItemIds) {
            await this.executeBatchJob(job)
          } else {
            await this.executeJob(job)
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          Sentry.captureException(new Error(`[JobRunner] Job ${job.type} (${job.id}) failed: ${error}`))
          try {
            await db.backgroundJobs.update(job.id, {
              status: 'failed' as JobStatus,
              error,
              updatedAt: new Date().toISOString(),
            })
          } catch (dbErr) {
            // AI19: If DB write fails, job is stuck — log but don't crash
            Sentry.captureException(dbErr instanceof Error ? dbErr : new Error('[JobRunner] Failed to update job status: ' + String(dbErr)))
          }
        } finally {
          this.abortControllers.delete(job.id)
          this.activeJobs--
          // Defer to next microtask so the guard is cleared before re-entering
          queueMicrotask(() => this.processQueue())
        }
      })()
    }
    } finally {
      this.processingQueue = false
    }
  }

  // ─── Single Job Execution ─────────────────────────────────────

  private async executeJob(job: BackgroundJob): Promise<void> {
    const config = JSON.parse(job.config) as Record<string, unknown>

    // Special handling for non-workflow job types
    if (job.type === 'study-plan' || job.type === 'session-insight') {
      await this.executeStandaloneJob(job, config)
      return
    }

    const workflow = reconstructWorkflow(job.type, config)
    await this.runWorkflowWithCheckpoints(job, workflow)

    // Auto-enqueue exam exercise processing after source processing for exam documents
    if (job.type === 'source-processing' && config.documentId) {
      try {
        const doc = await db.documents.get(config.documentId as string)
        if (doc?.category === 'exam') {
          // Check if exercises already extracted for this document
          const existingSource = await db.examSources
            .where('documentId').equals(doc.id)
            .first()
          if (!existingSource) {
            await this.enqueue(
              'exam-exercise-processing',
              job.examProfileId,
              { documentId: doc.id, isPro: config.isPro ?? false },
              3,
            )
          }
        }
      } catch {
        // Non-critical — don't fail the source processing job
      }
    }
  }

  private async runWorkflowWithCheckpoints(
    job: BackgroundJob,
    workflow: WorkflowDefinition<unknown>,
  ): Promise<void> {
    const controller = new AbortController()
    this.abortControllers.set(job.id, controller)

    // Restore checkpoint
    const completedStepIds = new Set<string>(JSON.parse(job.completedStepIds) as string[])
    const results: Record<string, StepResult> = JSON.parse(job.stepResults)

    // Build context
    let authToken = await this.getToken()
    if (!authToken) {
      await this.pauseJob(job.id, 'Auth token unavailable, will retry')
      return
    }

    const ctx: WorkflowContext = {
      examProfileId: job.examProfileId,
      authToken,
      signal: controller.signal,
      results,

      async updateProgress(substep: string): Promise<void> {
        await db.backgroundJobs.update(job.id, {
          currentStepName: substep,
          updatedAt: new Date().toISOString(),
        })
      },

      async llm(prompt: string, system?: string): Promise<string> {
        return callFastModel(
          prompt,
          system ?? 'You are a helpful assistant. Respond with the requested format only.',
          ctx.authToken,
          { maxTokens: 4096, signal: controller.signal },
        )
      },

      async searchSources(query: string, topN = 5): Promise<string> {
        const chunks = await hybridSearch(job.examProfileId, query, ctx.authToken, { topN })
        if (chunks.length === 0) return ''
        return chunks.map((c: { documentTitle?: string; content: string }) =>
          `[${c.documentTitle ?? 'Source'}]\n${c.content}`
        ).join('\n\n---\n\n')
      },

      async searchWeb(query: string): Promise<string> {
        return searchWebClient(query, ctx.authToken)
      },
    }

    let completedStepCount = completedStepIds.size

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i]

      if (controller.signal.aborted) {
        await db.backgroundJobs.update(job.id, {
          status: 'cancelled' as JobStatus,
          updatedAt: new Date().toISOString(),
        })
        return
      }

      // Skip already-completed steps (checkpoint resume)
      if (completedStepIds.has(step.id)) continue

      // Check shouldRun
      if (step.shouldRun && !step.shouldRun(ctx)) {
        results[step.id] = { status: 'skipped', durationMs: 0 }
        completedStepIds.add(step.id)
        await this.checkpoint(job.id, completedStepIds, results, ++completedStepCount, step.name)
        continue
      }

      // Refresh token before each step
      authToken = await this.getToken()
      if (!authToken) {
        await this.pauseJob(job.id, 'Auth token expired, will retry')
        return
      }
      ctx.authToken = authToken

      // Update current step name
      await db.backgroundJobs.update(job.id, {
        currentStepName: step.name,
        updatedAt: new Date().toISOString(),
      })

      const stepStart = Date.now()
      const MAX_RETRIES = 5
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Refresh token before each attempt
          if (attempt > 0) {
            const freshToken = await this.getToken()
            if (freshToken) ctx.authToken = freshToken
          }
          const data = await step.execute(undefined, ctx)
          results[step.id] = { status: 'completed', data, durationMs: Date.now() - stepStart }
          completedStepIds.add(step.id)
          completedStepCount++
          break
        } catch (err) {
          // If deliberately cancelled, don't retry — break immediately
          if (controller.signal.aborted) {
            results[step.id] = { status: 'failed', error: 'Cancelled', durationMs: Date.now() - stepStart }
            break
          }

          const error = err instanceof Error ? err.message : String(err)
          const isRetryable = error.includes('429') || error.includes('overloaded') || error.includes('rate limit') || error.includes('ECONNRESET') || error.includes('fetch failed') || error.includes('network error') || error.includes('Failed to fetch') || error.includes('NetworkError')

          if (isRetryable && attempt < MAX_RETRIES - 1) {
            // Parse "retry after N seconds" from error, fallback to exponential backoff with jitter
            const retryAfterMatch = error.match(/after (\d+) second/)
            const baseDelay = retryAfterMatch
              ? parseInt(retryAfterMatch[1], 10) * 1000
              : Math.min(2000 * Math.pow(2, attempt), 30000) // 2s, 4s, 8s, 16s, capped at 30s
            const jitter = Math.random() * 1000 // 0-1s random jitter
            const delay = baseDelay + jitter
            Sentry.captureMessage(`[JobRunner] Step "${step.name}" rate limited, retry ${attempt + 1}/${MAX_RETRIES - 1} in ${(delay / 1000).toFixed(1)}s: ${error}`, 'warning')
            await db.backgroundJobs.update(job.id, {
              currentStepName: `${step.name} (retry ${attempt + 1}...)`,
              updatedAt: new Date().toISOString(),
            })
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, delay)
              const onAbort = () => { clearTimeout(timer); reject(new Error('Cancelled')) }
              if (controller.signal.aborted) { clearTimeout(timer); reject(new Error('Cancelled')); return }
              controller.signal.addEventListener('abort', onAbort, { once: true })
            }).catch(() => { /* cancelled during sleep */ })
            if (controller.signal.aborted) break
            continue
          }

          Sentry.captureException(new Error(`[JobRunner] Step "${step.name}" failed: ${error}`))
          results[step.id] = { status: 'failed', error, durationMs: Date.now() - stepStart }

          if (!step.optional) {
            try {
              await db.backgroundJobs.update(job.id, {
                status: 'failed' as JobStatus,
                error: `Step "${step.name}" failed: ${error}`,
                updatedAt: new Date().toISOString(),
              })
            } catch (dbErr) {
              Sentry.captureException(dbErr instanceof Error ? dbErr : new Error('[JobRunner] Failed to mark job as failed: ' + String(dbErr)))
            }
            return
          }
          // Optional step failed — continue
          completedStepIds.add(step.id)
          completedStepCount++
          break
        }
      }

      // Checkpoint AFTER step try-catch — never fails the step itself
      await this.checkpoint(job.id, completedStepIds, results, completedStepCount, step.name)
    }

    // Aggregate final result
    try {
      await workflow.aggregate(ctx)
    } catch { /* aggregate failure is non-fatal */ }

    await db.backgroundJobs.update(job.id, {
      status: 'completed' as JobStatus,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedStepCount: workflow.steps.length,
      stepResults: JSON.stringify(results),
      completedStepIds: JSON.stringify([...completedStepIds]),
    })
  }

  // ─── Batch Job Execution ──────────────────────────────────────

  private async executeBatchJob(job: BackgroundJob): Promise<void> {
    const controller = new AbortController()
    this.abortControllers.set(job.id, controller)

    const config = JSON.parse(job.config) as Record<string, unknown>
    const allItemIds: string[] = JSON.parse(job.batchItemIds!)
    const completedIds = new Set<string>(JSON.parse(job.batchCompletedIds ?? '[]') as string[])
    const failedIds = new Set<string>(JSON.parse(job.batchFailedIds ?? '[]') as string[])
    const concurrency = job.batchConcurrency ?? 3

    // Filter to remaining items
    const remainingIds = allItemIds.filter(id => !completedIds.has(id) && !failedIds.has(id))
    if (remainingIds.length === 0) {
      await this.finalizeBatchJob(job, config, completedIds.size, failedIds.size)
      return
    }

    // Worker pool (semaphore pattern)
    const queue = [...remainingIds]

    const worker = async () => {
      while (queue.length > 0) {
        if (controller.signal.aborted) return
        const itemId = queue.shift()!

        // Build per-item config
        const itemConfig: Record<string, unknown> = {
          ...config,
          articleId: itemId,
        }

        try {
          const workflow = reconstructArticleWorkflow(itemConfig)

          // Create a mini-job context for this item (no checkpointing per step within items)
          let authToken = await this.getToken()
          if (!authToken) {
            failedIds.add(itemId)
            continue // Auth expired — mark item failed but keep processing others
          }

          const results: Record<string, StepResult> = {}
          const ctx: WorkflowContext = {
            examProfileId: job.examProfileId,
            authToken,
            signal: controller.signal,
            results,
            async llm(prompt: string, system?: string): Promise<string> {
              return callFastModel(
                prompt,
                system ?? 'You are a helpful assistant. Respond with the requested format only.',
                ctx.authToken,
                { maxTokens: 4096, signal: controller.signal },
              )
            },
            async searchSources(query: string, topN = 5): Promise<string> {
              const chunks = await hybridSearch(job.examProfileId, query, ctx.authToken, { topN })
              if (chunks.length === 0) return ''
              return chunks.map((c: { documentTitle?: string; content: string }) =>
                `[${c.documentTitle ?? 'Source'}]\n${c.content}`
              ).join('\n\n---\n\n')
            },
            async searchWeb(query: string): Promise<string> {
              return searchWebClient(query, ctx.authToken)
            },
          }

          for (const step of workflow.steps) {
            if (controller.signal.aborted) return

            if (step.shouldRun && !step.shouldRun(ctx)) {
              results[step.id] = { status: 'skipped', durationMs: 0 }
              continue
            }

            // Refresh token
            authToken = await this.getToken()
            if (!authToken) throw new Error('Auth token expired mid-item')
            ctx.authToken = authToken

            const stepStart = Date.now()
            try {
              const data = await step.execute(undefined, ctx)
              results[step.id] = { status: 'completed', data, durationMs: Date.now() - stepStart }
            } catch (err) {
              const error = err instanceof Error ? err.message : String(err)
              results[step.id] = { status: 'failed', error, durationMs: Date.now() - stepStart }
              if (!step.optional) throw new Error(`Step "${step.name}" failed: ${error}`)
            }
          }

          // Aggregate
          try { await workflow.aggregate(ctx) } catch { /* non-fatal */ }

          completedIds.add(itemId)
        } catch {
          failedIds.add(itemId)
        }

        // Checkpoint at item level
        await db.backgroundJobs.update(job.id, {
          batchCompletedIds: JSON.stringify([...completedIds]),
          batchFailedIds: JSON.stringify([...failedIds]),
          completedStepCount: completedIds.size + failedIds.size,
          currentStepName: `${completedIds.size + failedIds.size}/${allItemIds.length} items`,
          updatedAt: new Date().toISOString(),
        })
      }
    }

    const workerCount = Math.min(concurrency, remainingIds.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))

    if (!controller.signal.aborted) {
      await this.finalizeBatchJob(job, config, completedIds.size, failedIds.size)
    }
  }

  private async finalizeBatchJob(
    job: BackgroundJob,
    config: Record<string, unknown>,
    successCount: number,
    _failureCount: number,
  ): Promise<void> {
    await db.backgroundJobs.update(job.id, {
      status: 'completed' as JobStatus,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // Auto-enqueue synthesis if enough articles succeeded
    if (job.type === 'article-review-batch' && successCount >= 2) {
      const projectId = config.projectId as string
      await this.enqueue(
        'article-synthesis',
        job.examProfileId,
        { projectId },
        4, // synthesis has ~4 steps
      )
    }
  }

  // ─── Standalone (non-workflow) Jobs ────────────────────────────

  private async executeStandaloneJob(job: BackgroundJob, config: Record<string, unknown>): Promise<void> {
    const controller = new AbortController()
    this.abortControllers.set(job.id, controller)

    const authToken = await this.getToken()
    if (!authToken) {
      await this.pauseJob(job.id, 'Auth token unavailable')
      return
    }

    try {
      if (controller.signal.aborted) return
      if (job.type === 'study-plan') {
        const { generateStudyPlan } = await import('../studyPlanGenerator')
        await generateStudyPlan(
          job.examProfileId,
          authToken,
          config.daysAhead as number | undefined,
        )
      } else if (job.type === 'session-insight') {
        const { generateSessionInsight } = await import('../insightGenerator')
        await generateSessionInsight(
          (config.messages as Array<{ role: 'user' | 'assistant'; content: string }>).map(m => ({ id: crypto.randomUUID(), ...m })),
          job.examProfileId,
          config.conversationId as string,
          authToken,
        )
      }

      await db.backgroundJobs.update(job.id, {
        status: 'completed' as JobStatus,
        completedStepCount: job.totalSteps,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await db.backgroundJobs.update(job.id, {
        status: 'failed' as JobStatus,
        error,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private async checkpoint(
    jobId: string,
    completedStepIds: Set<string>,
    results: Record<string, StepResult>,
    completedStepCount: number,
    stepName: string,
  ): Promise<void> {
    // Serialize step results safely — strip non-serializable data gracefully
    let serializedResults = '{}'
    try {
      serializedResults = JSON.stringify(results)
    } catch {
      // If full results can't be serialized (e.g., large/complex step data),
      // save only status + durationMs for each step (enough for resume logic)
      const safeResults: Record<string, { status: string; durationMs: number; error?: string }> = {}
      for (const [key, val] of Object.entries(results)) {
        safeResults[key] = { status: val.status, durationMs: val.durationMs, error: val.error }
      }
      serializedResults = JSON.stringify(safeResults)
    }

    try {
      await db.backgroundJobs.update(jobId, {
        completedStepIds: JSON.stringify([...completedStepIds]),
        stepResults: serializedResults,
        completedStepCount,
        currentStepName: stepName,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      // Checkpoint failure is non-fatal — step data is still in memory
      Sentry.captureException(err instanceof Error ? err : new Error('[JobRunner] Checkpoint write failed: ' + String(err)))
    }
  }

  private async pauseJob(jobId: string, reason: string): Promise<void> {
    await db.backgroundJobs.update(jobId, {
      status: 'queued' as JobStatus,
      error: reason,
      updatedAt: new Date().toISOString(),
    })
  }
}
