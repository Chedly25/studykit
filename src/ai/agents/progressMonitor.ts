/**
 * Progress Monitor agent — the non-invasive proactive coach.
 * Watches mastery decay, exam proximity, study rhythm, streak health.
 * Writes insights to DB. UI surfaces read and display them inline.
 * Pure computation — no LLM calls.
 */
import { db } from '../../db'
import { decayedMastery, computeStreak } from '../../lib/knowledgeGraph'
import type { AgentDefinition, AgentContext, AgentResult } from './types'

export interface ProgressInsight {
  type: 'mastery-decay' | 'exam-approaching' | 'study-gap' | 'streak-risk'
    | 'weak-critical-topic' | 'ready-for-challenge' | 'improvement-detected'
  urgency: 'info' | 'attention' | 'urgent'
  title: string
  message: string
  surface: 'queue' | 'analytics' | 'study-plan'
  action?: { label: string; route: string }
}

export const progressMonitorAgent: AgentDefinition = {
  id: 'progress-monitor',
  name: 'Progress Monitor',
  description: 'Non-invasive coach that surfaces data-driven insights on existing UI',
  triggers: ['app-open', 'schedule'],
  model: 'fast',
  cooldownMs: 1800000, // 30 min

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { examProfileId } = ctx
    const insights: ProgressInsight[] = []

    const [profile, topics, subjects, logs, snapshots] = await Promise.all([
      db.examProfiles.get(examProfileId),
      db.topics.where('examProfileId').equals(examProfileId).toArray(),
      db.subjects.where('examProfileId').equals(examProfileId).toArray(),
      db.dailyStudyLogs.where('examProfileId').equals(examProfileId).toArray(),
      db.masterySnapshots.where('examProfileId').equals(examProfileId).toArray(),
    ])

    if (!profile || topics.length === 0) {
      return { success: true, summary: 'No data to monitor', episodes: [] }
    }

    const today = new Date().toISOString().slice(0, 10)
    const daysUntilExam = profile.examDate
      ? Math.max(0, Math.floor((new Date(profile.examDate).getTime() - Date.now()) / 86400000))
      : Infinity

    // 1. Exam approaching + weak topics
    if (daysUntilExam <= 7) {
      const weakForExam = topics.filter(t => t.mastery < 0.5)
      if (weakForExam.length > 0) {
        insights.push({
          type: 'exam-approaching',
          urgency: 'urgent',
          title: `Exam in ${daysUntilExam} days`,
          message: `${weakForExam.length} topic${weakForExam.length > 1 ? 's' : ''} below 50% mastery: ${weakForExam.slice(0, 3).map(t => t.name).join(', ')}`,
          surface: 'queue',
          action: { label: 'Start reviewing', route: '/queue' },
        })
      }
    }

    // 2. Mastery decay (topics that lost > 10% from stored mastery)
    if (daysUntilExam < 30) {
      const decayedTopics = topics.filter(t => {
        const decay = t.mastery - decayedMastery(t)
        return decay > 0.1
      })
      if (decayedTopics.length > 0) {
        const worst = decayedTopics.sort((a, b) => (b.mastery - decayedMastery(b)) - (a.mastery - decayedMastery(a)))[0]
        const decay = Math.round((worst.mastery - decayedMastery(worst)) * 100)
        insights.push({
          type: 'mastery-decay',
          urgency: 'attention',
          title: 'Knowledge fading',
          message: `${worst.name} dropped ${decay}% — a quick review would bring it back`,
          surface: 'queue',
          action: { label: 'Review now', route: '/queue' },
        })
      }
    }

    // 3. Study gap (no study for 3+ consecutive days)
    const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date))
    if (sortedLogs.length > 0) {
      const lastStudyDate = sortedLogs[0].date
      const daysSinceStudy = Math.floor((new Date(today).getTime() - new Date(lastStudyDate).getTime()) / 86400000)
      if (daysSinceStudy >= 3) {
        insights.push({
          type: 'study-gap',
          urgency: 'attention',
          title: `${daysSinceStudy} days without study`,
          message: 'Even 15 minutes of flashcard review helps maintain your progress',
          surface: 'queue',
          action: { label: 'Quick session', route: '/queue' },
        })
      }
    }

    // 4. Weak critical topic (high-weight subject with low mastery)
    for (const subject of subjects) {
      if (subject.weight < 25) continue
      const subjectTopics = topics.filter(t => t.subjectId === subject.id)
      const avgMastery = subjectTopics.length > 0
        ? subjectTopics.reduce((s, t) => s + t.mastery, 0) / subjectTopics.length
        : 0
      if (avgMastery < 0.4) {
        insights.push({
          type: 'weak-critical-topic',
          urgency: 'urgent',
          title: `${subject.name} needs attention`,
          message: `Worth ${subject.weight}% of your exam but only ${Math.round(avgMastery * 100)}% mastery`,
          surface: 'analytics',
          action: { label: 'Study this', route: '/queue' },
        })
      }
    }

    // 5. Improvement detected (topic crossed 0.8 since last snapshot)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    for (const topic of topics) {
      if (topic.mastery < 0.8) continue
      const oldSnapshot = snapshots.find(s => s.topicId === topic.id && s.date <= weekAgo)
      if (oldSnapshot && oldSnapshot.mastery < 0.8) {
        insights.push({
          type: 'improvement-detected',
          urgency: 'info',
          title: `${topic.name} mastered!`,
          message: `Went from ${Math.round(oldSnapshot.mastery * 100)}% to ${Math.round(topic.mastery * 100)}% this week`,
          surface: 'analytics',
        })
      }
    }

    // 6. Ready for challenge (all topics > 0.6 and exam > 14 days)
    if (daysUntilExam > 14 && topics.every(t => t.mastery > 0.6) && topics.length > 0) {
      insights.push({
        type: 'ready-for-challenge',
        urgency: 'info',
        title: 'Ready to level up',
        message: 'All topics above 60% — try a practice exam to test under pressure',
        surface: 'analytics',
        action: { label: 'Take practice exam', route: '/practice-exam' },
      })
    }

    // Write insights
    const now = new Date().toISOString()
    await db.agentInsights.put({
      id: `progress-monitor:${examProfileId}`,
      agentId: 'progress-monitor',
      examProfileId,
      data: JSON.stringify(insights),
      summary: `${insights.length} insight${insights.length !== 1 ? 's' : ''}: ${insights.filter(i => i.urgency === 'urgent').length} urgent, ${insights.filter(i => i.urgency === 'attention').length} attention`,
      createdAt: now,
      updatedAt: now,
    })

    return {
      success: true,
      data: insights,
      summary: `Generated ${insights.length} insights`,
      episodes: [],
    }
  },
}
