import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Topic, Subject, DailyStudyLog } from '../db/schema'
import {
  computeReadiness,
  getDueTopics,
  computeStreak,
  computeWeeklyHours,
  decayedMastery,
} from '../lib/knowledgeGraph'

export function useKnowledgeGraph(examProfileId: string | undefined) {
  const subjects = useLiveQuery(
    () => examProfileId
      ? db.subjects.where('examProfileId').equals(examProfileId).sortBy('order')
      : Promise.resolve([] as Subject[]),
    [examProfileId]
  ) ?? []

  const topics = useLiveQuery(
    () => examProfileId
      ? db.topics.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as Topic[]),
    [examProfileId]
  ) ?? []

  const dailyLogs = useLiveQuery(
    () => examProfileId
      ? db.dailyStudyLogs.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as DailyStudyLog[]),
    [examProfileId]
  ) ?? []

  const profile = useLiveQuery(
    () => examProfileId ? db.examProfiles.get(examProfileId) : undefined,
    [examProfileId]
  )

  // Compute decayed mastery for all topics
  const topicsWithDecay = topics.map(t => ({
    ...t,
    decayedMastery: decayedMastery(t),
  }))

  // Use decayed mastery for weak/strong topic identification
  const weakTopics = [...topicsWithDecay]
    .sort((a, b) => a.decayedMastery - b.decayedMastery)
    .slice(0, 5)
  const strongTopics = [...topicsWithDecay]
    .filter(t => t.decayedMastery > 0)
    .sort((a, b) => b.decayedMastery - a.decayedMastery)
    .slice(0, 5)

  // Readiness uses decayed subjects
  const decayedSubjects = subjects.map(s => {
    const subTopics = topicsWithDecay.filter(t => t.subjectId === s.id)
    const avgDecayed = subTopics.length > 0
      ? subTopics.reduce((sum, t) => sum + t.decayedMastery, 0) / subTopics.length
      : s.mastery
    return { ...s, mastery: avgDecayed }
  })
  const readiness = profile
    ? computeReadiness({ subjects: decayedSubjects, passingThreshold: profile.passingThreshold })
    : 0

  const dueTopics = getDueTopics(topics)
  const { streak, freezeUsed } = computeStreak(dailyLogs)
  const weeklyHours = computeWeeklyHours(dailyLogs)

  const getTopicsForSubject = (subjectId: string): Topic[] =>
    topics.filter(t => t.subjectId === subjectId)

  return {
    subjects,
    topics,
    topicsWithDecay,
    dailyLogs,
    readiness,
    weakTopics,
    strongTopics,
    dueTopics,
    streak,
    freezeUsed,
    weeklyHours,
    getTopicsForSubject,
  }
}
