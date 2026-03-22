/**
 * Agent type system — definitions for the 7 specialist agents.
 */
import type { TutoringEpisode, EpisodeType, DocumentChunk } from '../../db/schema'

// ─── Agent Identity ──────────────────────────────────────────────

export type AgentId =
  | 'diagnostician'
  | 'content-architect'
  | 'grader'
  | 'strategist'
  | 'retrieval'
  | 'misconception-hunter'
  | 'progress-monitor'
  | 'resource-scout'

export type AgentTrigger = 'event' | 'schedule' | 'app-open' | 'manual'

export type AgentModelType = 'fast' | 'main'

// ─── Agent Definition ────────────────────────────────────────────

export interface AgentDefinition {
  id: AgentId
  name: string
  description: string
  triggers: AgentTrigger[]
  model: AgentModelType
  /** Minimum interval between runs in ms (prevents spam). 0 = no limit. */
  cooldownMs: number
  execute: (ctx: AgentContext) => Promise<AgentResult>
}

// ─── Agent Context (injected at runtime) ─────────────────────────

export interface AgentContext {
  agentId: AgentId
  examProfileId: string
  userId: string
  /** Call the LLM (fast or main depending on agent definition) */
  llm: LlmFn
  /** Recall past tutoring episodes */
  recallEpisodes: (query: EpisodeQuery) => Promise<TutoringEpisode[]>
  /** Record a new tutoring episode */
  recordEpisode: (episode: Omit<TutoringEpisode, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  /** Semantic search over uploaded documents */
  search: (query: string, topN?: number) => Promise<SearchResult[]>
  /** Run the reflection loop on content */
  reflect: <T>(content: T, validator: Validator<T>) => Promise<ReflectionResult<T>>
  /** AbortSignal for timeout */
  signal: AbortSignal
}

// ─── Agent Result ────────────────────────────────────────────────

export interface AgentResult {
  success: boolean
  data?: unknown
  summary: string
  /** Episodes the agent wants recorded */
  episodes: Array<Omit<TutoringEpisode, 'id' | 'createdAt' | 'updatedAt'>>
}

// ─── Episodic Memory Queries ─────────────────────────────────────

export interface EpisodeQuery {
  userId: string
  topicId?: string
  topicName?: string
  type?: EpisodeType
  minEffectiveness?: number
  limit?: number
}

// ─── Search Result Wrapper ───────────────────────────────────────

export interface SearchResult {
  chunk: DocumentChunk
  score: number
  documentTitle?: string
}

// ─── Reflection Types ────────────────────────────────────────────

export interface ValidationResult {
  score: number           // 0-1
  issues: string[]
  suggestions: string[]
}

export interface Validator<T> {
  name: string
  minScore: number
  maxAttempts: number
  validate: (content: T, llm: LlmFn) => Promise<ValidationResult>
  buildFixPrompt: (content: T, issues: string[], suggestions: string[]) => string
  parseFixed: (raw: string, original: T) => T
}

export interface ReflectionResult<T> {
  content: T
  score: number
  wasFixed: boolean
  attempts: number
}

export type LlmFn = (prompt: string, system?: string) => Promise<string>
