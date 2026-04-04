/**
 * Email notifier — client-push model for daily study summaries.
 * Respects "data stays local": client assembles the payload.
 */

const SENT_KEY_PREFIX = 'studieskit_email_sent_'

function getSentKey(): string {
  return `${SENT_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`
}

export function alreadySentToday(): boolean {
  try {
    return localStorage.getItem(getSentKey()) === 'true'
  } catch {
    return false
  }
}

function markSentToday(): void {
  try {
    localStorage.setItem(getSentKey(), 'true')
  } catch {
    // localStorage unavailable
  }
}

interface DailySummary {
  profileName: string
  daysLeft: number
  readiness: number
  dueFlashcards: number
  streak: number
  weeklyHours: number
  topWeakTopics: string[]
}

export async function sendDailyEmail(
  _email: string,
  summary: DailySummary,
  authToken?: string,
): Promise<boolean> {
  if (alreadySentToday()) return false

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        template: 'daily-summary',
        data: summary,
      }),
    })

    if (response.ok) {
      markSentToday()
      return true
    }
    return false
  } catch {
    return false
  }
}
