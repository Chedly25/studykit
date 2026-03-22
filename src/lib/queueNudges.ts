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
      text: `You've revisited ${completedTopicName} ${topicCount} times now — that's how deep understanding forms`,
      type: 'reinforcement',
    }
  }

  // Halfway encouragement
  if (completedCount === Math.floor(totalCount / 2) && totalCount >= 4) {
    return {
      text: `You're halfway through — nice momentum! ${totalCount - completedCount} more to go`,
      type: 'progress',
    }
  }

  // 3 good ratings in a row
  if (sessionResults.length >= 3) {
    const last3 = sessionResults.slice(-3)
    if (last3.every(r => r.rating === 'good')) {
      return {
        text: 'Three strong answers in a row — you\'re in the zone',
        type: 'encouragement',
      }
    }
  }

  // Streak reference (first item only)
  if (streak >= 7 && completedCount === 1) {
    return {
      text: `Day ${streak} of your streak — that consistency is really paying off`,
      type: 'encouragement',
    }
  }

  // Almost done
  if (completedCount === totalCount - 1 && totalCount >= 3) {
    return {
      text: 'One more to go — you\'ve almost wrapped up today\'s session',
      type: 'progress',
    }
  }

  // Connection nudge: link topics that share context
  if (sessionResults.length >= 2) {
    const lastTwo = sessionResults.slice(-2)
    if (lastTwo[0].topicName !== lastTwo[1].topicName && Math.random() < 0.2) {
      return {
        text: `Nice — ${lastTwo[1].topicName} connects well with ${lastTwo[0].topicName}. Seeing those links strengthens both.`,
        type: 'connection',
      }
    }
  }

  return null
}
