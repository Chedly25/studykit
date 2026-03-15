import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { SessionInsight } from '../db/schema'

export function useSessionInsights(examProfileId: string | undefined) {
  const insights = useLiveQuery(
    () => examProfileId
      ? db.sessionInsights.where('examProfileId').equals(examProfileId).reverse().sortBy('timestamp')
      : Promise.resolve([] as SessionInsight[]),
    [examProfileId]
  ) ?? []

  const recentInsights = insights.slice(0, 5)

  return { insights, recentInsights }
}
