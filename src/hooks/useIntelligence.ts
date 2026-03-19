/**
 * Aggregates intelligence signals from mastery, calibration, exercises, and error patterns.
 * Surfaces proactive insights that were previously only available in the AI system prompt.
 */
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Topic, Subject } from '../db/schema'
import { decayedMastery } from '../lib/knowledgeGraph'
import { getMiscalibratedTopicsFromRaw } from '../lib/calibration'
import { computeErrorPatterns } from '../lib/errorPatterns'

export interface IntelligenceSignal {
  type: 'exercise-gap' | 'mastery-decay' | 'calibration' | 'error-pattern' | 'source-gap'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  actionLabel: string
  actionLink: string
  topicName?: string
  value?: number
}

export function useIntelligence(
  topics: Topic[],
  subjects: Subject[],
  examProfileId: string | undefined,
) {
  const exercises = useLiveQuery(
    () => examProfileId
      ? db.exercises.where('examProfileId').equals(examProfileId).toArray()
      : [],
    [examProfileId],
    [],
  )

  const questionResults = useLiveQuery(
    () => examProfileId
      ? db.questionResults.where('examProfileId').equals(examProfileId).toArray()
      : [],
    [examProfileId],
    [],
  )

  const documentChunks = useLiveQuery(
    () => examProfileId
      ? db.documentChunks.where('examProfileId').equals(examProfileId).toArray()
      : [],
    [examProfileId],
    [],
  )

  const signals = useMemo(() => {
    if (!examProfileId || topics.length === 0) return []

    const result: IntelligenceSignal[] = []

    // 1. Exercise gaps: topics with exercises available but 0 attempts
    const topicExerciseCounts = new Map<string, { total: number; attempted: number }>()
    for (const ex of exercises) {
      try {
        const ids: string[] = JSON.parse(ex.topicIds)
        for (const topicId of ids) {
          if (!topicExerciseCounts.has(topicId)) {
            topicExerciseCounts.set(topicId, { total: 0, attempted: 0 })
          }
          const entry = topicExerciseCounts.get(topicId)!
          entry.total++
          if (ex.status !== 'not_attempted') entry.attempted++
        }
      } catch { /* skip */ }
    }

    const unattemptedTopics = topics.filter(t => {
      const stats = topicExerciseCounts.get(t.id)
      return stats && stats.total > 0 && stats.attempted === 0
    })

    if (unattemptedTopics.length > 0) {
      const names = unattemptedTopics.slice(0, 3).map(t => t.name).join(', ')
      result.push({
        type: 'exercise-gap',
        severity: unattemptedTopics.length >= 3 ? 'high' : 'medium',
        title: `${unattemptedTopics.length} topic${unattemptedTopics.length > 1 ? 's' : ''} with unattempted exercises`,
        description: `${names}${unattemptedTopics.length > 3 ? ` and ${unattemptedTopics.length - 3} more` : ''} — exercises are available but you haven't tried any yet`,
        actionLabel: 'Start practicing',
        actionLink: `/exercises?topic=${encodeURIComponent(unattemptedTopics[0].name)}`,
        value: unattemptedTopics.length,
      })
    }

    // 2. Mastery decay: topics where mastery has decayed significantly
    const decayedTopics = topics
      .filter(t => t.mastery > 0.1)
      .map(t => ({
        topic: t,
        decayed: decayedMastery(t),
        drop: t.mastery - decayedMastery(t),
      }))
      .filter(d => d.drop > 0.15)
      .sort((a, b) => b.drop - a.drop)

    if (decayedTopics.length > 0) {
      const top = decayedTopics[0]
      result.push({
        type: 'mastery-decay',
        severity: top.drop > 0.3 ? 'high' : 'medium',
        title: `${decayedTopics.length} topic${decayedTopics.length > 1 ? 's' : ''} losing mastery`,
        description: `${top.topic.name} dropped from ${Math.round(top.topic.mastery * 100)}% to ${Math.round(top.decayed * 100)}% — review to prevent further decay`,
        actionLabel: 'Review',
        actionLink: `/session?topic=${encodeURIComponent(top.topic.name)}`,
        topicName: top.topic.name,
        value: Math.round(top.drop * 100),
      })
    }

    // 3. Calibration: overconfident/underconfident topics
    const miscalibrated = getMiscalibratedTopicsFromRaw(topics, subjects)
    const overconfident = miscalibrated.filter(d => d.isOverconfident)
    const underconfident = miscalibrated.filter(d => d.isUnderconfident)

    if (overconfident.length > 0) {
      const top = overconfident[0]
      result.push({
        type: 'calibration',
        severity: 'high',
        title: `Overconfident on ${top.topicName}`,
        description: `You rate yourself at ${Math.round(top.confidence * 100)}% but your scores show ${Math.round(top.mastery * 100)}% — try harder exercises to close the gap`,
        actionLabel: 'Practice',
        actionLink: `/exercises?topic=${encodeURIComponent(top.topicName)}`,
        topicName: top.topicName,
        value: Math.round(top.gap * 100),
      })
    }

    if (underconfident.length > 0) {
      const top = underconfident[0]
      result.push({
        type: 'calibration',
        severity: 'low',
        title: `You're better than you think at ${top.topicName}`,
        description: `Scores show ${Math.round(top.mastery * 100)}% but you rate yourself at ${Math.round(top.confidence * 100)}% — trust your knowledge more`,
        actionLabel: 'Review',
        actionLink: `/session?topic=${encodeURIComponent(top.topicName)}`,
        topicName: top.topicName,
      })
    }

    // 4. Error patterns: systematic error types
    const patterns = computeErrorPatterns(questionResults, topics)
    const significantPatterns = patterns.filter(p => p.totalErrors >= 3)

    if (significantPatterns.length > 0) {
      const top = significantPatterns[0]
      const typeLabel = top.dominantType === 'recall' ? 'memory/recall'
        : top.dominantType === 'conceptual' ? 'conceptual understanding'
        : top.dominantType === 'application' ? 'applying concepts'
        : 'distractor-related'
      result.push({
        type: 'error-pattern',
        severity: 'medium',
        title: `${top.topicName}: mostly ${typeLabel} errors`,
        description: `${top.totalErrors} errors, primarily ${typeLabel}. ${top.dominantType === 'recall' ? 'Use flashcards to strengthen memory.' : top.dominantType === 'conceptual' ? 'Review the theory more deeply.' : 'Practice with more exercises.'}`,
        actionLabel: top.dominantType === 'recall' ? 'Review flashcards' : 'Practice',
        actionLink: top.dominantType === 'recall' ? '/flashcard-maker' : `/exercises?topic=${encodeURIComponent(top.topicName)}`,
        topicName: top.topicName,
        value: top.totalErrors,
      })
    }

    // 5. Source coverage gaps: topics with no document chunks
    const topicsWithChunks = new Set<string>()
    for (const chunk of documentChunks) {
      if (chunk.topicId) topicsWithChunks.add(chunk.topicId)
    }
    const uncoveredTopics = topics.filter(t => !topicsWithChunks.has(t.id))
    if (uncoveredTopics.length > 0 && uncoveredTopics.length < topics.length) {
      result.push({
        type: 'source-gap',
        severity: 'low',
        title: `${uncoveredTopics.length} topic${uncoveredTopics.length > 1 ? 's' : ''} without course materials`,
        description: `Upload course materials covering ${uncoveredTopics.slice(0, 2).map(t => t.name).join(', ')} for better AI context`,
        actionLabel: 'Upload materials',
        actionLink: '/sources',
        value: uncoveredTopics.length,
      })
    }

    // Sort: high severity first
    const severityOrder = { high: 0, medium: 1, low: 2 }
    result.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return result
  }, [topics, subjects, exercises, questionResults, documentChunks, examProfileId])

  return { signals }
}
