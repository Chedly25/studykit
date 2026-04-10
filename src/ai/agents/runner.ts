/**
 * AgentRunner — executes agents, handles auth refresh, timeouts, scheduling.
 * Stateful singleton (same pattern as JobRunner).
 */
import { db } from '../../db'
import type { AgentRun } from '../../db/schema'
import type { AgentId, AgentTrigger, AgentContext, AgentResult, Validator, ReflectionResult } from './types'
import { agentRegistry } from './registry'
import { dispatchSwarmEvent } from './eventBus'
import { isAutopilotEnabled } from './autopilot/budgetTracker'
import { recallEpisodes, recordEpisode } from '../memory/episodicMemory'
import { reflect } from '../reflection/reflectionLoop'
import { callFastModel } from '../fastClient'
import { streamChat } from '../client'
import { hybridSearch } from '../../lib/hybridSearch'

const AGENT_TIMEOUT_MS = 60_000
const SCHEDULE_INTERVAL_MS = 30 * 60 * 1000

export class AgentRunner {
  private getToken: () => Promise<string | null>
  private schedulerInterval: ReturnType<typeof setInterval> | null = null
  private visibilityHandler: (() => void) | null = null
  private lastRunTimes = new Map<string, number>()
  private userId = ''

  constructor(getToken: () => Promise<string | null>) {
    this.getToken = getToken
  }

  setUserId(userId: string): void {
    if (userId !== this.userId) {
      this.lastRunTimes.clear()
    }
    this.userId = userId
  }

  // ─── Single Agent Execution ────────────────────────────────────

  async run(
    agentId: AgentId,
    examProfileId: string,
    userId?: string,
  ): Promise<AgentResult | null> {
    const effectiveUserId = userId ?? this.userId
    if (!effectiveUserId) return null

    const agent = agentRegistry.get(agentId)
    if (!agent) return null

    // Cooldown check
    const cooldownKey = `${agentId}:${examProfileId}`
    const lastRun = this.lastRunTimes.get(cooldownKey) ?? 0
    if (agent.cooldownMs > 0 && Date.now() - lastRun < agent.cooldownMs) {
      return null
    }

    const startTime = Date.now()
    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS)

    try {
      const authToken = await this.getToken()
      if (!authToken) return null

      // Build LLM function based on agent model type
      const llm = agent.model === 'fast'
        ? (prompt: string, system?: string) =>
            callFastModel(
              prompt,
              system ?? 'You are a helpful assistant.',
              authToken,
              { maxTokens: 4096, signal: abortController.signal },
            )
        : async (prompt: string, system?: string) => {
            const response = await streamChat({
              messages: [{ id: crypto.randomUUID(), role: 'user' as const, content: prompt }],
              system: system ?? 'You are a helpful assistant.',
              tools: [],
              authToken,
              signal: abortController.signal,
            })
            return response.content
              .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
              .map(c => c.text)
              .join('')
          }

      // Build agent context
      const ctx: AgentContext = {
        agentId,
        examProfileId,
        userId: effectiveUserId,
        llm,
        recallEpisodes: (query) => recallEpisodes({ ...query, userId: effectiveUserId }),
        recordEpisode: (episode) => recordEpisode(episode),
        search: async (query, topN = 5) => {
          const results = await hybridSearch(examProfileId, query, authToken, { topN })
          return results.map(r => ({
            chunk: {
              id: r.id,
              documentId: r.documentId,
              examProfileId: r.examProfileId,
              content: r.content,
              chunkIndex: r.chunkIndex,
              keywords: r.keywords,
              topicId: r.topicId,
            },
            score: r.score,
            documentTitle: r.documentTitle,
          }))
        },
        reflect: <T>(content: T, validator: Validator<T>): Promise<ReflectionResult<T>> =>
          reflect(content, validator, llm),
        signal: abortController.signal,
      }

      // Execute the agent
      const result = await agent.execute(ctx)

      // Record episodes returned by the agent
      let episodesRecorded = 0
      for (const episode of result.episodes) {
        try {
          await recordEpisode(episode)
          episodesRecorded++
        } catch { /* non-fatal */ }
      }

      this.lastRunTimes.set(cooldownKey, Date.now())
      await this.logRun(agentId, examProfileId, 'manual', 'success', result.summary, Date.now() - startTime, episodesRecorded)

      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      const status: AgentRun['status'] = abortController.signal.aborted ? 'timeout' : 'error'
      await this.logRun(agentId, examProfileId, 'manual', status, `Error: ${error}`, Date.now() - startTime, 0)
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  // ─── Trigger-based Execution ───────────────────────────────────

  async runByTrigger(
    trigger: AgentTrigger,
    examProfileId: string,
    userId?: string,
  ): Promise<void> {
    const agents = agentRegistry.getByTrigger(trigger)
    for (const agent of agents) {
      await this.run(agent.id, examProfileId, userId)
    }
  }

  // ─── Scheduler ─────────────────────────────────────────────────

  startScheduler(examProfileId: string): void {
    this.stopScheduler()

    this.schedulerInterval = setInterval(async () => {
      this.runByTrigger('schedule', examProfileId)
      // Dispatch autopilot sweep if enabled
      if (await isAutopilotEnabled(examProfileId)) {
        dispatchSwarmEvent({ type: 'autopilot-sweep', examProfileId, reason: 'schedule' })
      }
    }, SCHEDULE_INTERVAL_MS)

    if (typeof document !== 'undefined') {
      let lastAppOpenRun = 0
      this.visibilityHandler = () => {
        if (document.visibilityState !== 'visible') return
        // Throttle: don't re-run agents if tab became visible < 5 min ago
        if (Date.now() - lastAppOpenRun < 5 * 60 * 1000) return
        lastAppOpenRun = Date.now()

        this.runByTrigger('app-open', examProfileId)
        // Dispatch autopilot sweep if enabled
        isAutopilotEnabled(examProfileId).then(enabled => {
          if (enabled) {
            dispatchSwarmEvent({ type: 'autopilot-sweep', examProfileId, reason: 'app-open' })
          }
        })
      }
      document.addEventListener('visibilitychange', this.visibilityHandler)
    }
  }

  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval)
      this.schedulerInterval = null
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
  }

  // ─── Internal ──────────────────────────────────────────────────

  private async logRun(
    agentId: string,
    examProfileId: string,
    trigger: string,
    status: AgentRun['status'],
    summary: string,
    durationMs: number,
    episodesRecorded: number,
  ): Promise<void> {
    try {
      await db.agentRuns.put({
        id: crypto.randomUUID(),
        agentId,
        examProfileId,
        trigger: JSON.stringify(trigger),
        status,
        summary: summary.slice(0, 500),
        durationMs,
        episodesRecorded,
        createdAt: new Date().toISOString(),
      })
    } catch { /* non-fatal */ }
  }
}
