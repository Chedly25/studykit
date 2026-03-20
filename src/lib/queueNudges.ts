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

export function computeNudge(input: NudgeInput): Nudge | null {
  const { completedTopicName, completedCount, totalCount, sessionResults, streak } = input

  // 40% chance of returning null to avoid fatigue
  if (Math.random() < 0.4) return null

  // Topic repetition
  const topicCount = sessionResults.filter(r => r.topicName === completedTopicName).length
  if (topicCount >= 2) {
    return {
      text: `You've reviewed "${completedTopicName}" ${topicCount} times — building strong recall`,
      type: 'reinforcement',
    }
  }

  // Halfway encouragement
  if (completedCount === Math.floor(totalCount / 2) && totalCount >= 4) {
    return {
      text: `Halfway there! ${totalCount - completedCount} items to go`,
      type: 'progress',
    }
  }

  // 3 good ratings in a row
  if (sessionResults.length >= 3) {
    const last3 = sessionResults.slice(-3)
    if (last3.every(r => r.rating === 'good')) {
      return {
        text: 'Three in a row — you\'re in the zone',
        type: 'encouragement',
      }
    }
  }

  // Streak reference (first item only)
  if (streak >= 7 && completedCount === 1) {
    return {
      text: `Day ${streak} of your streak — consistency pays off`,
      type: 'encouragement',
    }
  }

  // Almost done
  if (completedCount === totalCount - 1 && totalCount >= 3) {
    return {
      text: 'Last one! You\'re almost done for today',
      type: 'progress',
    }
  }

  return null
}
