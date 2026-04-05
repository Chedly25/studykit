/**
 * Swarm Orchestrator — subscribes to events and triggers agent chains.
 *
 * This is the WIRING that connects existing systems:
 * - Document processed → auto-generate fiches
 * - Exam graded → run diagnostician + exam strategist + build remediation
 * - Mastery changed → flag for priority queue injection
 *
 * All actions are non-invasive: content silently appears in existing UI surfaces.
 */
import { subscribeSwarmEvents, type SwarmEvent } from './eventBus'
import { toast } from 'sonner'
import { db } from '../../db'

type EnqueueFn = (type: string, examProfileId: string, config: Record<string, unknown>, totalSteps: number) => Promise<string>
type RunAgentFn = (agentId: string, examProfileId: string) => Promise<void>

let initialized = false

/**
 * Initialize the swarm orchestrator. Call once on app mount.
 * Subscribes to the event bus and triggers appropriate chains.
 */
export function initSwarmOrchestrator(enqueue: EnqueueFn, runAgent: RunAgentFn): () => void {
  if (initialized) return () => {}
  initialized = true

  const unsubscribe = subscribeSwarmEvents(async (event) => {
    try {
      switch (event.type) {
        case 'document-processed':
          await handleDocumentProcessed(event, enqueue, runAgent)
          break
        case 'exam-graded':
          await handleExamGraded(event, enqueue, runAgent)
          break
        case 'mastery-changed':
          await handleMasteryChanged(event)
          break
        case 'misconception-detected':
          // Fiche updates already happen in grading pipeline
          // Additional handling could go here in the future
          break
      }
    } catch {
      // Swarm orchestrator must never crash the app
    }
  })

  return () => { unsubscribe(); initialized = false }
}

// ─── Activity Logging ─────────────────────────────────────────────

interface ActivityEntry {
  action: string
  summary: string
  timestamp: string
}

/** Append an entry to the swarm activity log (max 20 entries). */
async function logActivity(examProfileId: string, action: string, summary: string) {
  const key = `swarm-activity-log:${examProfileId}`
  const now = new Date().toISOString()
  try {
    const existing = await db.agentInsights.get(key)
    let entries: ActivityEntry[] = []
    if (existing?.data) {
      try { entries = JSON.parse(existing.data) } catch { entries = [] }
    }
    entries.push({ action, summary, timestamp: now })
    // Keep last 20
    if (entries.length > 20) entries = entries.slice(-20)
    await db.agentInsights.put({
      id: key,
      agentId: 'swarm-orchestrator',
      examProfileId,
      data: JSON.stringify(entries),
      summary: `${entries.length} recent swarm actions`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  } catch { /* non-critical */ }
}

/** Fire a toast only if the user is currently viewing the app. */
function swarmToast(message: string, description: string, duration = 4000) {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    toast(message, { description, duration })
  }
}

// ─── Event Handlers ─────────────────────────────────────────────

async function handleDocumentProcessed(
  event: Extract<SwarmEvent, { type: 'document-processed' }>,
  enqueue: EnqueueFn,
  runAgent: RunAgentFn,
) {
  const { documentId, examProfileId, category, topicIds } = event

  // 1. Auto-generate fiches for topics that got new content
  if (topicIds && topicIds.length > 0) {
    // Check which topics don't have fiches yet
    const existingFiches = await db.revisionFiches
      .where('examProfileId').equals(examProfileId)
      .toArray()
    const ficheTopicIds = new Set(existingFiches.map(f => f.topicId))

    const profile = await db.examProfiles.get(examProfileId)

    // Pre-fetch pending fiche jobs once (avoid O(jobs × topics) re-scan)
    const pendingJobs = await db.backgroundJobs
      .where('examProfileId').equals(examProfileId)
      .filter(j => j.type === 'fiche-generation' && (j.status === 'queued' || j.status === 'running'))
      .toArray()
    const pendingTopicIds = new Set(
      pendingJobs.map(j => { try { return (JSON.parse(j.config) as { topicId: string }).topicId } catch { return '' } })
    )

    const enqueuedNames: string[] = []

    for (const topicId of topicIds) {
      if (ficheTopicIds.has(topicId)) continue // Already has a fiche
      if (pendingTopicIds.has(topicId)) continue // Already pending

      const topic = await db.topics.get(topicId)
      const subject = topic?.subjectId ? await db.subjects.get(topic.subjectId) : null
      if (!topic || !subject) continue

      await enqueue('fiche-generation', examProfileId, {
        topicId,
        topicName: topic.name,
        subjectId: subject.id,
        subjectName: subject.name,
        examName: profile?.name ?? 'Exam',
      }, 1)

      enqueuedNames.push(topic.name)
      await logActivity(examProfileId, 'fiche-auto-generated', `Generated revision fiche for ${topic.name}`)
    }

    // Toast with accurate count of actually enqueued fiches
    if (enqueuedNames.length > 0) {
      const display = enqueuedNames.slice(0, 3).join(', ')
      swarmToast('✨ Generated revision fiches', `${enqueuedNames.length} fiches for ${display}`)
    }
  }

  // 2. Auto-trigger DNA analysis for exam papers
  if (category === 'exam') {
    const doc = await db.documents.get(documentId)
    if (doc) {
      // Check if any DNA analysis is already pending
      const pendingDNA = await db.backgroundJobs
        .where('examProfileId').equals(examProfileId)
        .filter(j => j.type === 'exam-dna-analysis' && (j.status === 'queued' || j.status === 'running'))
        .first()

      if (!pendingDNA) {
        const examDocs = await db.documents
          .where('examProfileId').equals(examProfileId)
          .filter(d => d.category === 'exam')
          .toArray()

        if (examDocs.length >= 2) {
          await enqueue('exam-dna-analysis', examProfileId, {
            documentIds: examDocs.map(d => d.id),
            name: `Auto-analyzed from ${examDocs.length} papers`,
            subject: 'maths-algebre', // Default — user can change on DNA page
          }, 1)
          await logActivity(examProfileId, 'dna-auto-triggered', `Analyzing ${examDocs.length} exam papers for DNA profile`)
        }
      }
    }
  }

  // 3. Run diagnostician to update priorities
  try {
    await runAgent('diagnostician', examProfileId)
  } catch { /* non-critical */ }
}

async function handleExamGraded(
  event: Extract<SwarmEvent, { type: 'exam-graded' }>,
  _enqueue: EnqueueFn,
  runAgent: RunAgentFn,
) {
  const { examProfileId, sessionId } = event

  // 1. Run diagnostician immediately (new exam = fresh data)
  try {
    await runAgent('diagnostician', examProfileId)
  } catch { /* non-critical */ }

  // 2. Run Exam Strategist
  try {
    await runAgent('exam-strategist', examProfileId)
    await logActivity(examProfileId, 'strategy-analyzed', 'Exam strategy ready — time allocation and efficiency analyzed')
    swarmToast('📊 Exam strategy ready')
  } catch { /* non-critical */ }

  // 3. Store remediation hints for the daily queue
  // The queue engine will pick these up on next build
  try {
    const session = await db.practiceExamSessions.get(sessionId)
    if (!session) return

    const questions = await db.generatedQuestions
      .where('sessionId').equals(sessionId)
      .toArray()

    // Find topics where student scored poorly
    const weakTopicNames = new Set<string>()
    for (const q of questions) {
      if (q.isCorrect === false && q.topicName) {
        weakTopicNames.add(q.topicName)
      }
    }

    if (weakTopicNames.size > 0) {
      // Store as an agent insight for the queue to pick up
      const now = new Date().toISOString()
      await db.agentInsights.put({
        id: `remediation:${examProfileId}`,
        agentId: 'swarm-orchestrator',
        examProfileId,
        data: JSON.stringify({
          sessionId,
          weakTopics: [...weakTopicNames],
          generatedAt: now,
        }),
        summary: `Remediation needed: ${weakTopicNames.size} weak topics from exam`,
        createdAt: now,
        updatedAt: now,
      })
      await logActivity(examProfileId, 'remediation-queued', `Added ${weakTopicNames.size} remediation exercises from your exam`)
      swarmToast('🎯 Queue updated', `${weakTopicNames.size} exercises added targeting your exam mistakes`)
    }
  } catch { /* non-critical */ }
}

async function handleMasteryChanged(
  event: Extract<SwarmEvent, { type: 'mastery-changed' }>,
) {
  const { topicId, examProfileId, oldMastery, newMastery } = event

  // Significant drop → store for queue priority boost
  if (oldMastery - newMastery > 0.15) {
    try {
      const existing = await db.agentInsights.get(`decay-alert:${examProfileId}`)
      const decayedTopics: string[] = existing?.data
        ? JSON.parse(existing.data).topics ?? []
        : []

      if (!decayedTopics.includes(topicId)) {
        decayedTopics.push(topicId)
      }

      const now = new Date().toISOString()
      await db.agentInsights.put({
        id: `decay-alert:${examProfileId}`,
        agentId: 'swarm-orchestrator',
        examProfileId,
        data: JSON.stringify({ topics: decayedTopics, updatedAt: now }),
        summary: `${decayedTopics.length} topics with significant mastery decay`,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })

      const topic = await db.topics.get(topicId)
      if (topic) {
        const dropPct = Math.round((oldMastery - newMastery) * 100)
        const masteryPct = Math.round(newMastery * 100)
        await logActivity(examProfileId, 'decay-detected', `${topic.name} mastery dropped to ${masteryPct}% — refresh queued`)
        swarmToast('📉 Mastery decay detected', `${topic.name} dropped ${dropPct}% — refresh queued`)
      }
    } catch { /* non-critical */ }
  }

  // Mastery milestone → record celebration episode
  if (newMastery >= 0.8 && oldMastery < 0.8) {
    try {
      const topic = await db.topics.get(topicId)
      if (topic) {
        await db.tutoringEpisodes.put({
          id: crypto.randomUUID(),
          userId: 'local',
          examProfileId,
          topicId,
          topicName: topic.name,
          type: 'mastery-change',
          description: `Mastery reached 80% on ${topic.name}`,
          context: JSON.stringify({ oldMastery, newMastery }),
          effectiveness: 1,
          tags: '["milestone"]',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
    } catch { /* non-critical */ }
  }
}
