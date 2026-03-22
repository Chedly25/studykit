# Agentic AI Architecture — Comprehensive Implementation Plan

> **Status:** Plan only — implement phase by phase via plan mode.
> **Scope:** 6 phases, ~60 new/modified files, transforms the AI from "LLM-with-tools" into an autonomous agent swarm.

---

## Principles

1. **Non-invasive.** Agents work silently. Students see better results, not more pop-ups. Insights surface inline on existing pages — never as interruptions.
2. **Agents are invisible workers.** The student doesn't know there are 7 agents. They see one product that's smarter than any single LLM call.
3. **Database-mediated coordination.** Agents communicate through IndexedDB. No complex event buses. One agent writes, another reads on its next run.
4. **Reflection by default.** Every generative step gets a verification pass. Bad content never reaches the student.
5. **Memory across sessions.** The system remembers what worked for each user. It gets better the more they use it.
6. **Measurable quality.** Every piece of AI content has an effectiveness score. We optimize what we can measure.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    STUDENT (UI)                         │
│  Dashboard · Queue · Reader · Analytics · StudyPlan     │
└─────────┬──────────────────────────────────┬────────────┘
          │ user actions                     │ inline insights
          ▼                                  ▲
┌─────────────────────┐    ┌─────────────────────────────┐
│   AGENT ROUTER      │    │   PROGRESS MONITOR          │
│   Routes chat to    │    │   Proactive data-driven     │
│   best specialist   │    │   nudges to existing UI     │
└────────┬────────────┘    └─────────────┬───────────────┘
         │                               │
         ▼                               ▼
┌──────────────────────────────────────────────────────┐
│                  AGENT SWARM                         │
│                                                      │
│  ┌──────────┐ ┌─────────┐ ┌────────┐ ┌───────────┐  │
│  │Diagnost- │ │Content  │ │Grader  │ │Strategist │  │
│  │ician     │ │Architect│ │        │ │           │  │
│  └──────────┘ └─────────┘ └────────┘ └───────────┘  │
│  ┌──────────┐ ┌─────────┐ ┌──────────────────────┐  │
│  │Retrieval │ │Misconc. │ │Progress Monitor      │  │
│  │Agent     │ │Hunter   │ │(proactive coach)     │  │
│  └──────────┘ └─────────┘ └──────────────────────┘  │
└──────────────────┬───────────────────────────────────┘
                   │ all agents use:
                   ▼
┌──────────────────────────────────────────────────────┐
│              SHARED INFRASTRUCTURE                    │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐            │
│  │Episodic  │ │Reflection│ │Evaluation │            │
│  │Memory    │ │Loop      │ │Pipeline   │            │
│  └──────────┘ └──────────┘ └───────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐            │
│  │RAG v2    │ │Adaptive  │ │Effectiven.│            │
│  │(hybrid)  │ │Prompts   │ │Tracker    │            │
│  └──────────┘ └──────────┘ └───────────┘            │
└──────────────────────────────────────────────────────┘
```

---

## The 7 Agents

| Agent | Role | Reactive / Proactive | Triggers |
|-------|------|---------------------|----------|
| **Diagnostician** | Analyzes student data. Identifies knowledge gaps, error patterns, calibration issues. Outputs a structured diagnostic that other agents consume. | Both | After practice exams. After 10+ flashcard reviews. On app open (daily). |
| **Content Architect** | Creates and improves study materials: fiches, flashcards, exercises. Runs the evaluation pipeline — scores content before saving, rewrites low-quality items. | Reactive | After document upload (already exists as source-processing, but upgraded). When Diagnostician flags a gap with no content. |
| **Grader** | Grades practice exams with a reflection step. Identifies error types and misconceptions. Verifies its own grades on ambiguous questions. | Reactive | When student submits a practice exam (upgrade of existing grading workflow). |
| **Strategist** | Builds study plans from diagnostic data. Monitors plan health. Detects when reality diverges from plan (missed sessions, unexpected weak spots). Proposes adjustments. | Both | On plan generation request. Weekly check on plan health. After diagnostic reveals new priorities. |
| **Retrieval** | Intelligent search across all documents. Hybrid keyword+semantic search, contextual enrichment, LLM re-ranking. Other agents call it for context. | Reactive | On every chat message. On any agent's request for source context. |
| **Misconception Hunter** | Detects recurring error patterns across exams and exercises. Builds/updates the misconception graph. Generates corrective exercises. | Both | After grading. After question logging. Weekly scan for unresolved patterns. |
| **Progress Monitor** | The non-invasive coach. Watches mastery decay, exam proximity, study rhythm, streak health. Writes insights to DB. Existing UI surfaces read and display them inline. | Proactive | On app open. Every 30 min while app is active. On significant state change (mastery drop, exam milestone). |

---

## Phase 1: Foundation Infrastructure

**Goal:** Build the core systems that every subsequent phase depends on: agent registry, episodic memory, reflection loop, and the effectiveness tracking schema.

### 1.1 Agent Registry & Types

**New file: `src/ai/agents/types.ts`**

```typescript
export type AgentId =
  | 'diagnostician'
  | 'content-architect'
  | 'grader'
  | 'strategist'
  | 'retrieval'
  | 'misconception-hunter'
  | 'progress-monitor'

export type AgentTrigger =
  | { type: 'event'; event: string }           // e.g., 'practice-exam-graded'
  | { type: 'schedule'; intervalMinutes: number }
  | { type: 'app-open' }
  | { type: 'manual' }

export interface AgentDefinition {
  id: AgentId
  name: string
  description: string
  triggers: AgentTrigger[]
  /** Which DB tables this agent reads */
  reads: string[]
  /** Which DB tables this agent writes */
  writes: string[]
  /** Run with fast model (background) or main model (interactive) */
  model: 'fast' | 'main'
  /** Max execution time in ms */
  timeoutMs: number
  /** The execute function */
  execute: (ctx: AgentContext) => Promise<AgentResult>
}

export interface AgentContext {
  examProfileId: string
  userId: string
  authToken: string
  signal: AbortSignal
  /** Call the LLM (routes to fast or main based on agent config) */
  llm: (prompt: string, system?: string) => Promise<string>
  /** Query episodic memory */
  recallEpisodes: (query: EpisodeQuery) => Promise<TutoringEpisode[]>
  /** Write to episodic memory */
  recordEpisode: (episode: Omit<TutoringEpisode, 'id' | 'createdAt'>) => Promise<void>
  /** Intelligent search (RAG v2 when available, falls back to current) */
  search: (query: string, topN?: number) => Promise<SearchResult[]>
  /** Run the reflection loop on generated content */
  reflect: <T>(content: T, validator: ReflectionValidator<T>) => Promise<T>
}

export interface AgentResult {
  success: boolean
  /** Structured output — schema varies by agent */
  data?: unknown
  /** Human-readable summary for logging */
  summary: string
  /** Episodes to record */
  episodes?: Omit<TutoringEpisode, 'id' | 'createdAt'>[]
}
```

**New file: `src/ai/agents/registry.ts`**

The registry holds all agent definitions. The runner uses it to look up agents by ID or by trigger.

```typescript
export class AgentRegistry {
  private agents = new Map<AgentId, AgentDefinition>()

  register(agent: AgentDefinition): void
  get(id: AgentId): AgentDefinition | undefined
  getByTrigger(trigger: AgentTrigger): AgentDefinition[]
  getAll(): AgentDefinition[]
}

export const agentRegistry = new AgentRegistry()
```

**New file: `src/ai/agents/runner.ts`**

The agent runner executes agents. It builds the `AgentContext`, handles timeouts and errors, records episodes, and logs results.

```typescript
export class AgentRunner {
  constructor(
    private registry: AgentRegistry,
    private getToken: () => Promise<string | null>,
  ) {}

  /** Run a specific agent */
  async run(agentId: AgentId, examProfileId: string, userId: string): Promise<AgentResult>

  /** Run all agents matching a trigger */
  async runByTrigger(trigger: AgentTrigger, examProfileId: string, userId: string): Promise<Map<AgentId, AgentResult>>

  /** Start the proactive scheduler (call on app mount) */
  startScheduler(): void
  stopScheduler(): void
}
```

The scheduler uses `setInterval` for scheduled agents and `document.addEventListener('visibilitychange')` for app-open triggers (detecting return-from-away — currently missing in the codebase).

**Modify: `src/components/BackgroundJobsProvider.tsx`**

Add `AgentRunner` alongside `JobRunner`. The provider creates both singletons and starts the agent scheduler on mount. Expose `runAgent(agentId)` via context for manual triggers.

### 1.2 Episodic Memory

**Modify: `src/db/schema.ts`** — add new tables:

```typescript
// Episodic memory — per-user, cross-profile
export type EpisodeType =
  | 'breakthrough'              // student understood after specific explanation
  | 'struggle'                  // student repeatedly failed on topic
  | 'misconception-corrected'   // a misconception was fixed
  | 'effective-strategy'        // a teaching strategy worked well
  | 'ineffective-strategy'      // a strategy didn't work
  | 'preference-observed'       // observed learning preference

export interface TutoringEpisode {
  id: string
  userId: string              // cross-profile (per user, not per exam profile)
  examProfileId?: string      // optional — some episodes are profile-specific
  topicId?: string
  topicName?: string
  type: EpisodeType
  description: string         // "The rows-as-functions analogy helped student understand matrix mult"
  context: string             // JSON — what was happening when this episode occurred
  effectiveness: number       // 0-1, updated based on follow-up performance
  tags: string                // JSON string[] — searchable tags
  createdAt: string
  updatedAt: string
}

// Agent execution log
export interface AgentRun {
  id: string
  agentId: string             // AgentId
  examProfileId: string
  trigger: string             // JSON AgentTrigger
  status: 'running' | 'completed' | 'failed'
  summary: string
  durationMs: number
  episodesRecorded: number
  createdAt: string
}
```

**New file: `src/ai/memory/episodicMemory.ts`**

```typescript
export interface EpisodeQuery {
  userId: string
  topicId?: string
  topicName?: string          // fuzzy match
  type?: EpisodeType
  minEffectiveness?: number
  limit?: number
}

/** Retrieve relevant episodes, sorted by effectiveness desc */
export async function recallEpisodes(query: EpisodeQuery): Promise<TutoringEpisode[]>

/** Record a new episode */
export async function recordEpisode(episode: Omit<TutoringEpisode, 'id' | 'createdAt'>): Promise<string>

/** Update effectiveness score based on outcome */
export async function updateEpisodeEffectiveness(episodeId: string, delta: number): Promise<void>

/** Garbage collect old, low-effectiveness episodes (keep max 500 per user) */
export async function pruneEpisodes(userId: string): Promise<number>
```

**DB version bump** required to add new tables + indexes.

### 1.3 Reflection Loop

**New file: `src/ai/reflection/reflectionLoop.ts`**

A generic verify-then-fix pipeline that any agent or workflow step can use.

```typescript
export interface ReflectionValidator<T> {
  /** System prompt for the verifier */
  verifierSystem: string
  /** Build the verification prompt from the content */
  buildVerificationPrompt: (content: T) => string
  /** Parse the verifier's response into a score + issues */
  parseVerification: (response: string) => {
    score: number           // 1-5
    issues: string[]
    suggestions: string[]
  }
  /** Minimum acceptable score (default 3) */
  minScore?: number
  /** Max retry attempts (default 1) */
  maxRetries?: number
  /** Build a fix prompt from original content + issues */
  buildFixPrompt: (content: T, issues: string[], suggestions: string[]) => string
  /** Parse the fixed content from the LLM response */
  parseFix: (response: string, original: T) => T
}

/**
 * Run the reflection loop:
 * 1. Verify content with a cheap LLM call
 * 2. If score < minScore, regenerate with fix prompt
 * 3. Return the best version
 */
export async function reflect<T>(
  content: T,
  validator: ReflectionValidator<T>,
  llm: (prompt: string, system?: string) => Promise<string>,
): Promise<{ content: T; score: number; wasFixed: boolean }>
```

Pre-built validators (separate file):

**New file: `src/ai/reflection/validators.ts`**

```typescript
export const flashcardValidator: ReflectionValidator<{ front: string; back: string }[]>
// Checks: cognitive level (not just recall), clarity, accuracy, no duplicates

export const conceptCardValidator: ReflectionValidator<{ title: string; content: string }>
// Checks: completeness (all sections present), accuracy vs source, depth

export const exerciseValidator: ReflectionValidator<{ text: string; solutionText: string }>
// Checks: solvability, difficulty calibration, solution correctness

export const gradeValidator: ReflectionValidator<{ questionId: string; isCorrect: boolean; feedback: string }>
// Checks: grading consistency, feedback quality, edge case handling
```

### 1.4 Effectiveness Tracking

**Modify: `src/db/schema.ts`** — add:

```typescript
export interface ContentEffectiveness {
  id: string
  contentType: 'flashcard' | 'concept-card' | 'exercise' | 'quiz-question'
  contentId: string
  examProfileId: string
  /** The generation strategy used (e.g., 'rich-fiche-v1', 'diagnostic-exercise') */
  generationStrategy: string
  /** Quality score from reflection loop (1-5) at generation time */
  generationScore: number
  /** Aggregated student performance on this content */
  interactionCount: number
  successRate: number          // 0-1, running average
  /** Last SM-2 rating or self-assessment */
  lastRating: number
  createdAt: string
  updatedAt: string
}

/** Aggregated effectiveness per generation strategy */
export interface StrategyEffectiveness {
  id: string                   // strategy name
  contentType: string
  totalGenerated: number
  avgGenerationScore: number
  avgSuccessRate: number
  avgInteractionCount: number
  updatedAt: string
}
```

**New file: `src/lib/effectivenessTracker.ts`**

```typescript
/** Record a new piece of AI-generated content */
export async function trackContentCreation(
  contentType: string, contentId: string, examProfileId: string,
  generationStrategy: string, generationScore: number,
): Promise<void>

/** Record a student interaction with content (review, attempt, etc.) */
export async function trackContentInteraction(
  contentId: string, rating: number, isSuccess: boolean,
): Promise<void>

/** Get effectiveness stats for a generation strategy */
export async function getStrategyStats(strategy: string): Promise<StrategyEffectiveness | null>

/** Get the best-performing strategies for a content type */
export async function getBestStrategies(
  contentType: string, limit?: number,
): Promise<StrategyEffectiveness[]>
```

### 1.5 Wiring

**Modify: `src/db/index.ts`** — bump DB version, add new tables:
- `tutoringEpisodes` — indexed on `[userId]`, `[userId+topicId]`, `[userId+type]`
- `agentRuns` — indexed on `[examProfileId+agentId]`, `[createdAt]`
- `contentEffectiveness` — indexed on `[contentId]`, `[examProfileId+contentType]`, `[generationStrategy]`
- `strategyEffectiveness` — indexed on `[contentType]`

### Phase 1 Verification

- `agentRegistry.getAll()` returns empty array (no agents registered yet)
- `recallEpisodes({ userId })` returns empty array
- `reflect(content, flashcardValidator, llm)` returns content with score
- `trackContentCreation` + `trackContentInteraction` + `getStrategyStats` round-trips
- All new tables queryable via Dexie

---

## Phase 2: RAG v2

**Goal:** Replace the current O(N) cosine similarity scan with hybrid search + re-ranking. Immediately improves answer quality for every chat message.

### 2.1 Contextual Chunk Enrichment

**New file: `src/lib/contextualRetrieval.ts`**

At upload time, before embedding, prepend a context sentence to each chunk.

```typescript
/**
 * Enrich chunks with contextual prefixes for better retrieval.
 * Uses the fast model to generate a 1-sentence context per chunk.
 * Batches chunks to minimize LLM calls.
 */
export async function enrichChunksWithContext(
  chunks: DocumentChunk[],
  documentTitle: string,
  documentSummary: string,
  authToken: string,
): Promise<Map<string, string>>  // chunkId → enriched content
```

The prompt per batch (8 chunks):
```
Document: "{title}"
Summary: "{summary}"

For each chunk below, generate a single context sentence that situates it within
the document. The sentence should mention the document title, the topic, and the
chapter/section if identifiable.

Chunk 1: {content preview}
Chunk 2: ...

Return JSON: [{ "chunkIndex": 0, "context": "This chunk from [title] discusses..." }]
```

**Modify: `src/db/schema.ts`** — add to `DocumentChunk`:
```typescript
  contextPrefix?: string    // Generated context for retrieval enrichment
```

**Modify: `src/ai/workflows/sourceProcessing.ts`**

After step 2 (analyze document), add a new step that runs `enrichChunksWithContext` and writes `contextPrefix` to each chunk. Only runs for Pro users. The enriched content (contextPrefix + content) is used for embedding in the existing embed step.

**Modify: `src/lib/embeddings.ts` — `embedAndStoreChunks`**

When embedding, use `chunk.contextPrefix + '\n' + chunk.content` if contextPrefix exists.

### 2.2 Keyword Search

**New file: `src/lib/keywordSearch.ts`**

BM25-inspired keyword search using the existing `keywords` field on `DocumentChunk`.

```typescript
export interface KeywordSearchResult {
  chunkId: string
  documentId: string
  score: number
  content: string
}

/**
 * BM25-style keyword search over chunk keywords + content.
 * No API calls — pure IndexedDB + in-memory scoring.
 */
export async function keywordSearch(
  examProfileId: string,
  query: string,
  topN?: number,
): Promise<KeywordSearchResult[]>
```

Implementation:
1. Tokenize query → lowercase, remove stopwords, stem (light Porter stemmer)
2. Load all chunks for the profile (same as current semantic search — they're already in IndexedDB)
3. For each chunk: score = sum of BM25(term, chunk) for each query term
4. BM25 uses the `keywords` field (comma-separated terms) + content word frequency
5. Return top N sorted by score

### 2.3 Hybrid Search + Re-ranking

**New file: `src/lib/hybridSearch.ts`**

```typescript
export interface HybridSearchResult {
  chunkId: string
  documentId: string
  documentTitle: string
  content: string
  score: number
  /** Which search found it: 'semantic', 'keyword', or 'both' */
  source: string
}

/**
 * Hybrid search: semantic + keyword with reciprocal rank fusion.
 * Optionally re-ranks top results with a fast LLM call.
 */
export async function hybridSearch(
  examProfileId: string,
  query: string,
  authToken: string | undefined,
  options?: {
    topN?: number           // default 5
    rerank?: boolean        // default true if authToken available
    semanticWeight?: number // default 0.6
    keywordWeight?: number  // default 0.4
  },
): Promise<HybridSearchResult[]>
```

Implementation:
1. Run `semanticSearch` and `keywordSearch` in parallel
2. Apply reciprocal rank fusion: `score = w1 / (k + rank_semantic) + w2 / (k + rank_keyword)` where k=60
3. Take top 20 candidates
4. If `rerank` is true: send the 20 candidates + query to fast model:
   ```
   Given this student question: "{query}"
   Rank these {N} text passages by relevance. Return a JSON array of chunk IDs
   in order from most to least relevant. Only include the top 5.
   ```
5. Return re-ranked top N

**Modify: `src/lib/embeddings.ts`**

Replace `semanticSearch` calls across the codebase with `hybridSearch`. The old function stays as a fallback called by `hybridSearch` internally.

Files to update:
- `src/hooks/useAgent.ts` — pre-retrieval in sendMessage
- `src/ai/tools/sourceTools.ts` — searchSourcesTool
- `src/ai/tools/reviewTools.ts` — searchReviewArticles
- `src/ai/workflows/practiceExam.ts` — document search step

### Phase 2 Verification

- Upload a document → chunks get `contextPrefix` populated
- Chat message triggers hybrid search → results include keyword-only matches that semantic search would miss
- Re-ranking moves the most relevant chunk to position 1 (test with a specific query where position changes)
- Fallback to semantic-only works when no auth token

---

## Phase 3: Adaptive Intelligence

**Goal:** Make the existing chat agent significantly smarter by deeply integrating the student model, episodic memory, and killing static prompt modes.

### 3.1 Adaptive Prompt Construction

**New file: `src/ai/adaptivePrompt.ts`**

Replaces the static `buildSystemPrompt` for chat interactions.

```typescript
export async function buildAdaptivePrompt(ctx: AdaptivePromptContext): Promise<string>

interface AdaptivePromptContext extends PromptContext {
  userId: string
  recentEpisodes: TutoringEpisode[]
  currentTopicId?: string
}
```

The adaptive prompt:

1. **Base persona** — kept from current `buildSystemPrompt`, but trimmed (remove redundant rules)

2. **Student-aware rules** — dynamically constructed from `StudentModel`:
   ```
   // If student has "rushes-to-answer" in commonMistakes:
   "Before answering, slow this student down. Ask: 'What assumptions are we making here?'"

   // If student has "visual" in learningStyle:
   "This student learns best with spatial metaphors, diagrams, and worked examples with step visualization."

   // If student has "needs-encouragement" in personalityNotes:
   "Acknowledge effort before corrections. This student responds well to positive reinforcement."
   ```

3. **Episode-informed context** — inject relevant episodes:
   ```
   ## What has worked before for this student
   - On [topic]: The analogy of [X] led to a breakthrough (effectiveness: 0.9)
   - On [topic]: Step-by-step derivation worked better than definition-first (effectiveness: 0.8)

   ## What has NOT worked
   - On [topic]: Abstract definitions confused the student (effectiveness: 0.2)
   ```

4. **Dynamic tool selection** — based on student state:
   - If topic mastery < 0.3: enable `renderConceptCard` tool, disable `renderQuiz`
   - If mastery > 0.7: enable `renderQuiz`, enable higher-difficulty settings
   - If misconceptions exist for current topic: inject them into prompt

5. **Calibration data** — wire up the currently dead `buildCalibrationSection`:
   ```
   ## Calibration alerts
   - Student is OVERCONFIDENT on Probability (confidence: 85%, actual accuracy: 52%)
     → Challenge with harder questions, don't accept "I know this" at face value
   - Student is UNDERCONFIDENT on Linear Algebra (confidence: 30%, actual accuracy: 78%)
     → Reassure and point out their strong track record
   ```

### 3.2 Episode Recording from Chat

**Modify: `src/ai/insightGenerator.ts`**

After generating a `SessionInsight`, also extract and record `TutoringEpisode`s:

```typescript
// Added to the LLM prompt for insight generation:
"Also identify any tutoring episodes:
- breakthroughs: what explanation/analogy/approach worked
- struggles: what didn't work, what confused the student
- preferences: observed learning style signals
Return as: episodes: [{ type, description, topicName, tags }]"
```

Each extracted episode is written via `recordEpisode()`. The `effectiveness` field starts at 0.5 (neutral) and gets updated by the learning-from-outcomes system in Phase 6.

### 3.3 Fix insightGenerator mastery sign bug

**Modify: `src/ai/insightGenerator.ts`** — line 119

The current code strips the minus sign from negative mastery changes. Fix:
```typescript
// Before: parseFloat(String(change).replace(/[+%]/g, ''))
// After:  parseFloat(String(change).replace(/[%]/g, ''))
```

### 3.4 Agent Router for Chat

**New file: `src/ai/agents/chatRouter.ts`**

Instead of the user toggling between socratic/explain-back/standard modes, the router automatically picks the best approach.

```typescript
export interface RoutingDecision {
  /** Which prompt style to use */
  style: 'teach' | 'question' | 'diagnose' | 'encourage' | 'challenge'
  /** Additional system prompt addendum */
  addendum: string
  /** Which tools to enable/disable */
  toolOverrides?: Record<string, boolean>
}

/**
 * Analyze the conversation state and decide the best approach.
 * This is a CHEAP call — fast model, ~100 tokens output.
 */
export async function routeChat(
  messages: Message[],
  studentModel: StudentModel,
  topic: Topic | null,
  recentEpisodes: TutoringEpisode[],
  llm: (prompt: string, system?: string) => Promise<string>,
): Promise<RoutingDecision>
```

The router prompt:
```
Student profile: [mastery, confidence, recent performance]
Topic: [name, mastery, known misconceptions]
Conversation so far: [last 3 messages summary]
Past episodes: [what worked/didn't work]

Decide the best teaching approach for the NEXT response:
- "teach": Student needs explanation (new topic, low mastery)
- "question": Student should think (medium mastery, needs active recall)
- "diagnose": Need to understand what the student knows/doesn't know
- "encourage": Student is struggling emotionally, needs support
- "challenge": Student is doing well, push harder

Return JSON: { "style": "...", "reason": "..." }
```

**Modify: `src/hooks/useAgent.ts`**

In `sendMessage`, before building the system prompt:
1. Call `routeChat` with current state
2. Use the routing decision to select prompt style + addendum
3. Remove `isSocratic`, `isExplainBack` state and related mode-switching logic
4. The router replaces manual mode selection

### Phase 3 Verification

- Chat response quality noticeably improves for returning students (episodes inform approach)
- Overconfident students get challenged, underconfident get encouraged
- No more manual mode toggling — the agent adapts automatically
- Mastery changes from insights have correct sign (positive and negative)

---

## Phase 4: Agent Swarm

**Goal:** Implement all 7 specialist agents. This is the largest phase.

### 4.1 Diagnostician Agent

**New file: `src/ai/agents/diagnostician.ts`**

Analyzes student performance data and produces a structured diagnostic.

**Triggers:**
- `app-open` (daily, once per day via localStorage gate)
- `event: practice-exam-graded`
- `event: flashcard-session-completed` (after 10+ reviews)

**Inputs:** Topics, question results (last 50), flashcard performance, exam patterns, misconceptions, daily study logs.

**Process:**
1. Load all relevant data from IndexedDB
2. Compute: weak areas, error clusters, calibration gaps, mastery decay, study rhythm issues
3. Send to fast model with structured analysis prompt
4. Parse into `DiagnosticReport`

```typescript
export interface DiagnosticReport {
  timestamp: string
  /** Top 5 priority areas needing attention */
  priorities: Array<{
    topicId: string
    topicName: string
    urgency: 'critical' | 'high' | 'medium' | 'low'
    reason: string
    suggestedAction: 'review' | 'practice' | 'relearn' | 'assess'
  }>
  /** Detected patterns */
  patterns: Array<{
    type: 'error-cluster' | 'mastery-decay' | 'calibration-gap' | 'study-gap' | 'improvement'
    description: string
    topicIds: string[]
  }>
  /** Overall readiness assessment */
  readiness: {
    score: number
    trend: 'improving' | 'stable' | 'declining'
    riskAreas: string[]
  }
}
```

**Output:** Writes `DiagnosticReport` to a new `agentInsights` table (keyed by agentId + examProfileId, only latest kept). Other agents and UI components read this.

**Modify: `src/db/schema.ts`** — add:
```typescript
export interface AgentInsight {
  id: string                // agentId:examProfileId
  agentId: string
  examProfileId: string
  data: string              // JSON — agent-specific structured data
  summary: string           // Human-readable summary
  createdAt: string
  updatedAt: string
}
```

### 4.2 Content Architect Agent

**New file: `src/ai/agents/contentArchitect.ts`**

Creates and improves study materials. Uses the reflection loop and effectiveness tracking.

**Triggers:**
- `event: source-processing-completed`
- `event: diagnostic-gap-detected` (when Diagnostician finds a topic with low mastery but no content)

**Process:**
1. Read the Diagnostician's latest report to identify priority topics
2. For each priority topic with insufficient content:
   a. Search documents for relevant chunks (via Retrieval agent)
   b. Check existing concept cards and flashcards
   c. Generate new content (fiches, flashcards)
   d. Run through reflection loop (verify quality)
   e. Track creation via effectiveness tracker
3. For existing content with low effectiveness scores:
   a. Regenerate with a different strategy
   b. Compare new vs old via reflection
   c. Replace if new version scores higher

**Key difference from current source-processing:** The Content Architect is strategic — it generates content *where it's needed*, not just for every uploaded document. It also evaluates and iterates.

### 4.3 Grader Agent (Upgraded)

**Modify: `src/ai/workflows/practiceExamGrading.ts`**

Add a reflection step between grading and saving:

**New step: `verifyGrades`** (after `gradeSubjective`, before `generateFeedback`)

```typescript
// For each subjective grade:
// 1. Run gradeValidator reflection
// 2. If score < 3: re-grade with more context
// 3. If ambiguous: flag for student review ("The AI isn't sure about this one")
```

Also: after grading, the Grader writes structured data that the Misconception Hunter can consume (currently it writes misconceptions directly — that responsibility moves to the Misconception Hunter).

### 4.4 Strategist Agent

**New file: `src/ai/agents/strategist.ts`**

Builds and monitors study plans based on diagnostic data.

**Triggers:**
- `manual` (user requests a plan)
- `schedule: 10080` (weekly plan health check)
- `event: diagnostic-completed`

**Process for plan health check:**
1. Load current active plan + actual study logs
2. Compare planned vs actual (which activities were done, skipped, extra)
3. If divergence > 30%: generate an adjustment recommendation
4. Write recommendation to `AgentInsight` table
5. The StudyPlan page reads this insight and shows a subtle banner (reuses existing `replanSuggestion` mechanism)

**Process for plan generation:**
Replaces the current `generateStudyPlan` function. Uses diagnostic data to inform topic ordering, exam pattern data for weighting, and episodic memory to avoid strategies that didn't work before.

### 4.5 Retrieval Agent

**New file: `src/ai/agents/retrievalAgent.ts`**

Wraps the RAG v2 hybrid search with agent-level intelligence.

```typescript
export interface RetrievalRequest {
  query: string
  topicId?: string
  purpose: 'chat' | 'content-generation' | 'grading' | 'diagnosis'
  topN?: number
}

export interface RetrievalResult {
  chunks: HybridSearchResult[]
  /** Cross-document synthesis if multiple docs match */
  synthesis?: string
}
```

When `purpose` is `content-generation`, the Retrieval agent:
1. Runs hybrid search
2. If results span multiple documents: generates a brief synthesis of how they relate
3. Returns both raw chunks and the synthesis

When `purpose` is `chat`, it just returns hybrid search results (fast path).

### 4.6 Misconception Hunter Agent

**New file: `src/ai/agents/misconceptionHunter.ts`**

Specializes in detecting, tracking, and remediating misconceptions.

**Triggers:**
- `event: practice-exam-graded`
- `event: question-logged` (batched — runs after 5+ new results)
- `schedule: 10080` (weekly deep scan)

**Process:**
1. Load recent question results + existing misconceptions
2. Analyze error patterns via fast model:
   ```
   Here are 15 recent wrong answers for this student across topics.
   Identify recurring misconceptions — patterns where the SAME conceptual error
   appears across different questions. Don't flag simple recall failures.

   Return: [{ description, topicId, evidence: [questionResultIds], severity: 1-5 }]
   ```
3. Merge with existing misconception graph (dedup, increment counts)
4. For unresolved misconceptions with count >= 3: auto-enqueue `misconception-exercise` job (already exists)
5. Record episodes: "Detected recurring misconception: {description}"

### 4.7 Progress Monitor Agent (Proactive Coach)

**New file: `src/ai/agents/progressMonitor.ts`**

The non-invasive proactive agent. Outputs data-driven nudges to existing UI surfaces.

**Triggers:**
- `app-open`
- `schedule: 30` (every 30 min while app active)

**Process:**
1. Check all conditions (pure data, no LLM needed for most):

```typescript
interface ProgressInsight {
  type: 'mastery-decay' | 'exam-approaching' | 'study-gap' | 'streak-risk'
    | 'weak-critical-topic' | 'ready-for-challenge' | 'improvement-detected'
  urgency: 'info' | 'attention' | 'urgent'
  title: string
  message: string
  /** Where this insight should appear */
  surface: 'dashboard' | 'queue' | 'analytics' | 'study-plan'
  /** Optional action suggestion */
  action?: { label: string; route: string }
  /** Auto-dismiss after this many views (default: 3) */
  maxViews?: number
}
```

2. Conditions checked (all pure computation, no LLM):

| Condition | Insight Type | Urgency |
|-----------|-------------|---------|
| Topic mastery dropped > 10% from peak | `mastery-decay` | attention |
| Exam in <= 7 days + topic mastery < 0.5 | `exam-approaching` | urgent |
| No study for 3+ days | `study-gap` | attention |
| Streak at risk (studied yesterday but not today, evening) | `streak-risk` | info |
| High-weight topic with mastery < 0.4 | `weak-critical-topic` | urgent |
| Topic mastery crossed 0.8 | `improvement-detected` | info |
| All topics > 0.6 mastery | `ready-for-challenge` | info |

3. Write insights to `AgentInsight` table with `agentId = 'progress-monitor'`

**UI Integration (no new components — modify existing):**

**Modify: `src/pages/DailyQueue.tsx`** — Before the queue header, read `progress-monitor` insights with `surface: 'queue'` and render as a slim banner (similar to existing nudge banners). Auto-dismiss after 3 views.

**Modify: `src/pages/Analytics.tsx`** — Add a "Coach Insights" section that reads `progress-monitor` insights with `surface: 'analytics'`. Render as small cards.

**Modify: `src/components/dashboard/HeroFocusCard.tsx`** — If urgent insights exist, show the most urgent one as a subtle line below the focus card.

### Phase 4 Verification

- On app open: Diagnostician runs, writes report to `agentInsights`
- After document upload: Content Architect generates reflected, evaluated content
- After practice exam: Grader verifies its grades, Misconception Hunter updates graph
- Queue page shows Progress Monitor insights inline (non-invasive)
- `agentRuns` table logs all agent executions with timing

---

## Phase 5: Evaluation Pipeline + Goal Decomposition

**Goal:** Add quality gates on all AI-generated content and enable multi-step planning for complex chat requests.

### 5.1 Evaluation Pipeline

**New file: `src/ai/evaluation/evaluator.ts`**

```typescript
export interface ContentEvaluation {
  score: number              // 1-5
  cognitiveLevel: 'recall' | 'understand' | 'apply' | 'analyze'
  issues: string[]
  redundancyScore: number    // 0-1 (vs existing content)
  examRelevance: number      // 0-1 (based on exam patterns)
  action: 'keep' | 'rewrite' | 'discard'
}

/** Evaluate a batch of flashcards before saving */
export async function evaluateFlashcards(
  cards: Array<{ front: string; back: string }>,
  existingCards: Array<{ front: string; back: string }>,
  examPatterns: ExamPattern[],
  llm: (prompt: string, system?: string) => Promise<string>,
): Promise<Array<ContentEvaluation & { cardIndex: number }>>

/** Evaluate a concept card before saving */
export async function evaluateConceptCard(
  card: { title: string; content: string },
  sourceContent: string,
  llm: (prompt: string, system?: string) => Promise<string>,
): Promise<ContentEvaluation>
```

**Integration points:**

**Modify: `src/ai/workflows/sourceProcessing.ts`** — After generating flashcards (step 2) and concept cards (step 4), run the evaluation pipeline. Discard `action: 'discard'` items. Rewrite `action: 'rewrite'` items. Track all via effectiveness tracker.

**Modify: `src/ai/tools/conceptCardTools.ts`** — `saveConceptCard()` runs evaluation before DB write. If `action: 'discard'`, return a message to the LLM asking it to try again.

### 5.2 Goal Decomposition Planner

**New file: `src/ai/planner/goalDecomposer.ts`**

For complex student requests ("Help me prepare for my statistics exam"), decompose into a multi-step plan.

```typescript
export interface StudyGoalPlan {
  goal: string
  steps: PlanStep[]
}

export interface PlanStep {
  action: 'diagnose' | 'teach' | 'practice' | 'assess' | 'retrieve'
  topic: string
  description: string
  tools: string[]              // which tools this step should use
  completionCriteria: string   // how to know this step is done
}

/**
 * Decompose a student's goal into actionable steps.
 * The agent loop executes one step at a time.
 */
export async function decomposeGoal(
  userMessage: string,
  diagnosticReport: DiagnosticReport | null,
  topics: Topic[],
  llm: (prompt: string, system?: string) => Promise<string>,
): Promise<StudyGoalPlan | null>
```

Returns `null` for simple questions that don't need decomposition (most messages).

**Modify: `src/ai/agentLoop.ts`**

At the start of the loop, before the first LLM call:
1. Call `decomposeGoal` with the user's message
2. If a plan is returned: inject it into the system prompt as a structured addendum
3. The LLM sees: "You have a plan to follow. Execute step 1 first. After completing it, move to step 2."
4. The plan is also sent as a visible message so the student can see and adjust it

### 5.3 Tool Composition

**Modify: `src/ai/toolDefinitions.ts`** — add a meta-tool:

```typescript
{
  name: 'executeSequence',
  description: 'Execute a sequence of tools as a single action. Use when you need to search, then create content based on what you found.',
  input_schema: {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tool: { type: 'string' },
            input: { type: 'object' },
            useOutputFrom: { type: 'number', description: 'Index of previous step whose output to include' },
          },
          required: ['tool', 'input'],
        },
      },
    },
    required: ['steps'],
  },
}
```

**Modify: `src/ai/agentLoop.ts`** — `executeToolLocally`

Handle `executeSequence` by running each step in order, passing previous outputs as context. Reduces round-trips from 3+ agent loop iterations to 1.

### Phase 5 Verification

- Generated flashcards: ~20% are discarded or rewritten by evaluation (vs 0% before)
- "Help me prepare for my exam" → visible multi-step plan, executed step by step
- `executeSequence` with search→quiz creates a quiz grounded in source content in 1 iteration

---

## Phase 6: Learning from Outcomes

**Goal:** Close the feedback loop. Track what works, optimize generation strategies, make the system self-improving.

### 6.1 Instrument All Content Interactions

**Modify: `src/pages/DailyQueue.tsx`**

In `FlashcardReviewInline.handleRate`:
```typescript
trackContentInteraction(card.id, quality, quality >= 3)
```

In `ExerciseInline.handleRate`:
```typescript
trackContentInteraction(exercise.id, score, score >= 0.7)
```

In `ConceptQuizInline.handleRate`:
```typescript
trackContentInteraction(card.id, quality, quality >= 3)
```

### 6.2 Episode Effectiveness Updates

**New file: `src/ai/memory/effectivenessUpdater.ts`**

Runs as a background job (weekly). For each episode:
1. Find the topic it relates to
2. Check if mastery improved after the episode was recorded
3. If improved within 7 days: `effectiveness += 0.1` (capped at 1.0)
4. If no improvement or decline: `effectiveness -= 0.05` (floored at 0.0)
5. This naturally bubbles up the most effective teaching strategies

### 6.3 Strategy Optimization

**New file: `src/ai/optimization/strategyOptimizer.ts`**

Runs monthly (or on-demand). Analyzes `StrategyEffectiveness` data.

```typescript
export interface StrategyRecommendation {
  contentType: string
  currentBestStrategy: string
  averageSuccessRate: number
  recommendation: string
}

/**
 * Analyze what's working and what isn't.
 * Returns recommendations for improving generation strategies.
 */
export async function analyzeStrategies(): Promise<StrategyRecommendation[]>

/**
 * Get the best generation prompt/approach for a content type.
 * Used by Content Architect to pick the right strategy.
 */
export async function getOptimalStrategy(
  contentType: string,
  topicId?: string,
  studentModel?: StudentModel,
): Promise<{ strategy: string; promptModifications: string }>
```

The Content Architect calls `getOptimalStrategy` before generating content. If the data shows that "worked-example-heavy fiches" have 40% better success rate than "definition-first fiches" for this student, it adjusts its prompt accordingly.

### 6.4 Wiring into Content Architect

**Modify: `src/ai/agents/contentArchitect.ts`**

Before generating:
```typescript
const { strategy, promptModifications } = await getOptimalStrategy('flashcard', topicId, studentModel)
// Inject promptModifications into the generation prompt
// Track with: trackContentCreation('flashcard', id, profileId, strategy, reflectionScore)
```

### Phase 6 Verification

- After 50+ flashcard reviews: `StrategyEffectiveness` table has data per strategy
- `getOptimalStrategy` returns different strategies for different students/topics
- Content Architect adapts its prompts based on effectiveness data
- Episode effectiveness scores diverge (effective episodes > 0.7, ineffective < 0.3)

---

## File Index

### New Files (26)

| File | Phase | Purpose |
|------|-------|---------|
| `src/ai/agents/types.ts` | 1 | Agent interfaces, context, result types |
| `src/ai/agents/registry.ts` | 1 | Agent registry singleton |
| `src/ai/agents/runner.ts` | 1 | Agent execution engine + scheduler |
| `src/ai/memory/episodicMemory.ts` | 1 | Read/write/prune episodic memory |
| `src/ai/reflection/reflectionLoop.ts` | 1 | Generic verify-then-fix pipeline |
| `src/ai/reflection/validators.ts` | 1 | Pre-built validators for flashcards, cards, exercises, grades |
| `src/lib/effectivenessTracker.ts` | 1 | Track AI content effectiveness |
| `src/lib/contextualRetrieval.ts` | 2 | Chunk context enrichment at upload time |
| `src/lib/keywordSearch.ts` | 2 | BM25-style keyword search |
| `src/lib/hybridSearch.ts` | 2 | Hybrid search + re-ranking |
| `src/ai/adaptivePrompt.ts` | 3 | Adaptive prompt construction from student model + episodes |
| `src/ai/agents/chatRouter.ts` | 3 | Auto-route chat to best teaching approach |
| `src/ai/agents/diagnostician.ts` | 4 | Performance analysis agent |
| `src/ai/agents/contentArchitect.ts` | 4 | Content generation/improvement agent |
| `src/ai/agents/strategist.ts` | 4 | Study plan optimization agent |
| `src/ai/agents/retrievalAgent.ts` | 4 | Intelligent search wrapper |
| `src/ai/agents/misconceptionHunter.ts` | 4 | Error pattern detection + remediation |
| `src/ai/agents/progressMonitor.ts` | 4 | Proactive non-invasive coach |
| `src/ai/evaluation/evaluator.ts` | 5 | Content quality scoring |
| `src/ai/planner/goalDecomposer.ts` | 5 | Complex request decomposition |
| `src/ai/memory/effectivenessUpdater.ts` | 6 | Update episode effectiveness from outcomes |
| `src/ai/optimization/strategyOptimizer.ts` | 6 | Analyze and recommend generation strategies |

### Modified Files (19)

| File | Phase | Changes |
|------|-------|---------|
| `src/db/schema.ts` | 1,4 | TutoringEpisode, AgentRun, ContentEffectiveness, StrategyEffectiveness, AgentInsight tables; DocumentChunk.contextPrefix |
| `src/db/index.ts` | 1 | DB version bump, new table registration + indexes |
| `src/components/BackgroundJobsProvider.tsx` | 1 | Add AgentRunner alongside JobRunner |
| `src/ai/workflows/sourceProcessing.ts` | 2,5 | Contextual enrichment step; evaluation pipeline |
| `src/lib/embeddings.ts` | 2 | Use contextPrefix in embedding; hybridSearch as primary |
| `src/hooks/useAgent.ts` | 3 | Replace static prompts with adaptive; remove mode toggles; add router |
| `src/ai/systemPrompt.ts` | 3 | Wire up dead sections (calibration, dependencies); used by adaptivePrompt |
| `src/ai/insightGenerator.ts` | 3 | Fix mastery sign bug; extract episodic episodes |
| `src/ai/tools/sourceTools.ts` | 2 | Use hybridSearch |
| `src/ai/agentLoop.ts` | 5 | Goal decomposition injection; executeSequence tool |
| `src/ai/toolDefinitions.ts` | 5 | Add executeSequence meta-tool |
| `src/ai/tools/conceptCardTools.ts` | 5 | Evaluation before save |
| `src/ai/workflows/practiceExamGrading.ts` | 4 | Reflection step on grades |
| `src/pages/DailyQueue.tsx` | 4,6 | Progress monitor insights; effectiveness tracking on ratings |
| `src/pages/Analytics.tsx` | 4 | Coach insights section |
| `src/components/dashboard/HeroFocusCard.tsx` | 4 | Urgent insight display |
| `src/ai/tools/reviewTools.ts` | 2 | Use hybridSearch |
| `src/ai/workflows/practiceExam.ts` | 2 | Use hybridSearch in search step |
| `src/ai/agents/contentArchitect.ts` | 6 | Strategy optimization integration |

---

## Implementation Order

| Phase | Name | Depends On | Effort | Shippable? |
|-------|------|-----------|--------|------------|
| 1 | Foundation | — | 2 sessions | Yes (invisible infra, but reflection loop improves quality) |
| 2 | RAG v2 | — | 2 sessions | Yes (better search = better answers immediately) |
| 3 | Adaptive Intelligence | Phase 1 | 2 sessions | Yes (smarter chat, no more mode toggling) |
| 4 | Agent Swarm | Phase 1, 2, 3 | 3-4 sessions | Yes (proactive insights appear in UI) |
| 5 | Evaluation + Planning | Phase 1, 4 | 2 sessions | Yes (higher quality content, multi-step plans) |
| 6 | Learning from Outcomes | Phase 1, 4, 5 | 2 sessions | Yes (system improves over time) |

**Phases 1 and 2 can run in parallel.** Phase 3 needs Phase 1 (episodic memory). Phase 4 needs all three. Phases 5 and 6 build on Phase 4.

Total estimated: **13-16 sessions**.
