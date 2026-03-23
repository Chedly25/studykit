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
        subject: `StudiesKit Daily: ${summary.daysLeft} days until ${esc(summary.profileName)}`,
        html: buildEmailHtml(summary),
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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildEmailHtml(s: DailySummary): string {
  return `
<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
  <h2>Daily Study Summary</h2>
  <p><strong>${esc(s.profileName)}</strong> — ${s.daysLeft} days left</p>
  <ul>
    <li>Readiness: ${s.readiness}%</li>
    <li>Study streak: ${s.streak} days</li>
    <li>This week: ${s.weeklyHours}h studied</li>
    <li>Flashcards due: ${s.dueFlashcards}</li>
  </ul>
  ${s.topWeakTopics.length > 0 ? `
  <p><strong>Focus areas:</strong></p>
  <ul>${s.topWeakTopics.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
  ` : ''}
  <p><a href="https://studieskit.com/dashboard">Open StudiesKit</a></p>
</div>`
}
