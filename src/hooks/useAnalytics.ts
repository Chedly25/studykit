import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { DailyStudyLog, StudySession, Subject, QuestionResult, Topic } from '../db/schema'
import {
  computeWeeklyHoursChart,
  computeSessionDistribution,
  computeSubjectBalance,
  computeScoreTrend,
} from '../lib/analyticsEngine'

export function useAnalytics(examProfileId: string | undefined) {
  const dailyLogs = useLiveQuery(
    () => examProfileId
      ? db.dailyStudyLogs.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as DailyStudyLog[]),
    [examProfileId]
  ) ?? []

  const sessions = useLiveQuery(
    () => examProfileId
      ? db.studySessions.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as StudySession[]),
    [examProfileId]
  ) ?? []

  const subjects = useLiveQuery(
    () => examProfileId
      ? db.subjects.where('examProfileId').equals(examProfileId).sortBy('order')
      : Promise.resolve([] as Subject[]),
    [examProfileId]
  ) ?? []

  const questionResults = useLiveQuery(
    () => examProfileId
      ? db.questionResults.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as QuestionResult[]),
    [examProfileId]
  ) ?? []

  const topics = useLiveQuery(
    () => examProfileId
      ? db.topics.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as Topic[]),
    [examProfileId]
  ) ?? []

  const weeklyHours = computeWeeklyHoursChart(dailyLogs)
  const sessionDistribution = computeSessionDistribution(sessions)
  const subjectBalance = computeSubjectBalance(subjects, dailyLogs)
  const scoreTrend = computeScoreTrend(questionResults)

  return {
    weeklyHours,
    sessionDistribution,
    subjectBalance,
    scoreTrend,
    dailyLogs,
    sessions,
    subjects,
    topics,
    questionResults,
  }
}
