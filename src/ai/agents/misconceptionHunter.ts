/**
 * Misconception Hunter agent — detects recurring error patterns across
 * exams and exercises, builds/updates the misconception graph,
 * auto-enqueues corrective exercises for persistent misconceptions.
 */
import { db } from '../../db'
import type { AgentDefinition, AgentContext, AgentResult } from './types'

export const misconceptionHunterAgent: AgentDefinition = {
  id: 'misconception-hunter',
  name: 'Misconception Hunter',
  description: 'Detects recurring error patterns and generates targeted corrections',
  triggers: ['app-open', 'manual'],
  model: 'fast',
  cooldownMs: 3600000, // 1 hour

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { examProfileId } = ctx
    const episodes: AgentResult['episodes'] = []

    // Load recent wrong answers
    const recentResults = await db.questionResults
      .where('examProfileId')
      .equals(examProfileId)
      .toArray()

    const wrongAnswers = recentResults
      .filter(r => !r.isCorrect)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 30)

    if (wrongAnswers.length < 5) {
      return { success: true, summary: 'Too few wrong answers to analyze', episodes: [] }
    }

    // Load existing misconceptions and topics
    const [existingMisconceptions, topics] = await Promise.all([
      db.misconceptions.where('examProfileId').equals(examProfileId).toArray(),
      db.topics.where('examProfileId').equals(examProfileId).toArray(),
    ])

    const topicMap = new Map(topics.map(t => [t.id, t.name]))

    // Build prompt for LLM analysis
    const wrongAnswerList = wrongAnswers.slice(0, 15).map(q => {
      const topicName = topicMap.get(q.topicId) ?? 'Unknown'
      return `Topic: ${topicName}, Q: ${q.question.slice(0, 150)}, Student: ${q.userAnswer.slice(0, 100)}, Correct: ${q.correctAnswer.slice(0, 100)}${q.errorType ? `, Error type: ${q.errorType}` : ''}`
    }).join('\n')

    const existingList = existingMisconceptions
      .filter(m => !m.resolvedAt)
      .slice(0, 10)
      .map(m => `- "${m.description}" (${topicMap.get(m.topicId) ?? 'Unknown'}, seen ${m.occurrenceCount}x)`)
      .join('\n')

    try {
      const raw = await ctx.llm(
        `Here are recent wrong answers from this student:
${wrongAnswerList}

${existingList ? `Existing known misconceptions:\n${existingList}` : 'No existing misconceptions recorded.'}

Identify NEW recurring misconceptions — patterns where the SAME conceptual error appears across multiple questions. Don't repeat existing misconceptions. Don't flag simple recall failures — only conceptual misunderstandings.

Return JSON: { "misconceptions": [{ "description": "specific misconception in one sentence", "topicName": "topic name", "evidence": ["brief evidence 1", "brief evidence 2"], "severity": 1-5 }] }
Only JSON.`,
        'You are a learning diagnostics expert. Identify conceptual misconceptions from student error patterns. Return only valid JSON.',
      )

      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) return { success: true, summary: 'Could not parse LLM response', episodes: [] }

      const parsed = JSON.parse(match[0]) as {
        misconceptions?: Array<{
          description?: string
          topicName?: string
          evidence?: string[]
          severity?: number
        }>
      }

      const newMisconceptions = parsed.misconceptions ?? []
      let created = 0
      let updated = 0

      for (const m of newMisconceptions.slice(0, 5)) {
        if (!m.description || !m.topicName) continue

        const topic = topics.find(t => t.name.toLowerCase() === m.topicName!.toLowerCase())
        if (!topic) continue

        // Check if this matches an existing misconception
        const existing = existingMisconceptions.find(
          e => e.topicId === topic.id && e.description.toLowerCase() === m.description!.toLowerCase()
        )

        const now = new Date().toISOString()

        // Severity is supplied by the LLM (1-5). Clamp + default to 3 if missing.
        // Ratchet up only on repeats — never decrease severity.
        const llmSeverity = typeof m.severity === 'number'
          ? Math.max(1, Math.min(5, Math.round(m.severity)))
          : 3

        if (existing) {
          await db.misconceptions.update(existing.id, {
            occurrenceCount: existing.occurrenceCount + 1,
            lastSeenAt: now,
            severity: Math.max(existing.severity ?? 1, llmSeverity),
          })
          updated++
        } else {
          await db.misconceptions.put({
            id: crypto.randomUUID(),
            examProfileId,
            topicId: topic.id,
            description: m.description,
            occurrenceCount: 1,
            severity: llmSeverity,
            firstSeenAt: now,
            lastSeenAt: now,
            exerciseIds: '[]',
            questionResultIds: '[]',
          })
          created++

          episodes.push({
            userId: ctx.userId,
            examProfileId,
            topicId: topic.id,
            topicName: topic.name,
            type: 'misconception-detected',
            description: `New misconception detected: ${m.description}`,
            context: JSON.stringify({ evidence: m.evidence, severity: m.severity }),
            effectiveness: 0.5,
            tags: JSON.stringify(['misconception', topic.name.toLowerCase()]),
          })
        }
      }

      // Auto-enqueue exercises for persistent misconceptions (count >= 3, unresolved)
      const persistent = await db.misconceptions
        .where('examProfileId')
        .equals(examProfileId)
        .filter(m => !m.resolvedAt && m.occurrenceCount >= 3)
        .toArray()

      if (persistent.length > 0) {
        // Check if a misconception-exercise job is already queued/running
        const existingJob = await db.backgroundJobs
          .where('examProfileId')
          .equals(examProfileId)
          .filter(j => j.type === 'misconception-exercise' && (j.status === 'queued' || j.status === 'running'))
          .first()

        if (!existingJob) {
          const now = new Date().toISOString()
          await db.backgroundJobs.put({
            id: crypto.randomUUID(),
            examProfileId,
            type: 'misconception-exercise',
            status: 'queued',
            config: JSON.stringify({ examProfileId, maxMisconceptions: 3 }),
            completedStepIds: '[]',
            stepResults: '{}',
            totalSteps: 3,
            completedStepCount: 0,
            currentStepName: '',
            createdAt: now,
            updatedAt: now,
          })
        }
      }

      return {
        success: true,
        data: { created, updated, persistent: persistent.length },
        summary: `Found ${created} new, updated ${updated} existing. ${persistent.length} persistent misconceptions.`,
        episodes,
      }
    } catch {
      return { success: false, summary: 'Misconception analysis failed', episodes: [] }
    }
  },
}
