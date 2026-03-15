import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Topic, Subject, DailyStudyLog } from '../db/schema'
import {
  computeReadiness,
  getWeakTopics,
  getStrongTopics,
  getDueTopics,
  computeStreak,
  computeWeeklyHours,
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

  // Computed values
  const readiness = profile
    ? computeReadiness({ subjects, passingThreshold: profile.passingThreshold })
    : 0

  const weakTopics = getWeakTopics(topics)
  const strongTopics = getStrongTopics(topics)
  const dueTopics = getDueTopics(topics)
  const streak = computeStreak(dailyLogs)
  const weeklyHours = computeWeeklyHours(dailyLogs)

  const getTopicsForSubject = (subjectId: string): Topic[] =>
    topics.filter(t => t.subjectId === subjectId)

  return {
    subjects,
    topics,
    dailyLogs,
    readiness,
    weakTopics,
    strongTopics,
    dueTopics,
    streak,
    weeklyHours,
    getTopicsForSubject,
  }
}
