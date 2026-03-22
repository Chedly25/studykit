/**
 * Local nudges between queue items — computed from local data, no AI call.
 */

export interface SessionResult {
  topicName: string
  type: string
  rating: 'struggled' | 'ok' | 'good'
}

export interface Nudge {
  text: string
  type: 'reinforcement' | 'connection' | 'progress' | 'encouragement'
}

interface NudgeInput {
  completedTopicName: string
  completedCount: number
  totalCount: number
  sessionResults: SessionResult[]
  streak: number
}

export function computeNudge(input: NudgeInput, t: (key: string, opts?: Record<string, unknown>) => string): Nudge | null {
  const { completedTopicName, completedCount, totalCount, sessionResults, streak } = input

  // 40% chance of returning null to avoid fatigue
  if (Math.random() < 0.4) return null

  // Topic repetition
  const topicCount = sessionResults.filter(r => r.topicName === completedTopicName).length
  if (topicCount >= 2) {
    return {
      text: t('nudge.revisited', { topic: completedTopicName, count: topicCount }),
      type: 'reinforcement',
    }
  }

  // Halfway encouragement
  if (completedCount === Math.floor(totalCount / 2) && totalCount >= 4) {
    return {
      text: t('nudge.halfway', { remaining: totalCount - completedCount }),
      type: 'progress',
    }
  }

  // 3 good ratings in a row
  if (sessionResults.length >= 3) {
    const last3 = sessionResults.slice(-3)
    if (last3.every(r => r.rating === 'good')) {
      return {
        text: t('nudge.threeInARow'),
        type: 'encouragement',
      }
    }
  }

  // Streak reference (first item only)
  if (streak >= 7 && completedCount === 1) {
    return {
      text: t('nudge.dayOfStreak', { streak }),
      type: 'encouragement',
    }
  }

  // Almost done
  if (completedCount === totalCount - 1 && totalCount >= 3) {
    return {
      text: t('nudge.almostDone'),
      type: 'progress',
    }
  }

  // Connection nudge: link topics that share context
  if (sessionResults.length >= 2) {
    const lastTwo = sessionResults.slice(-2)
    if (lastTwo[0].topicName !== lastTwo[1].topicName && Math.random() < 0.2) {
      return {
        text: t('nudge.connection', { topic1: lastTwo[1].topicName, topic2: lastTwo[0].topicName }),
        type: 'connection',
      }
    }
  }

  return null
}
