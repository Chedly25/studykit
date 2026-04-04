/**
 * Server-side email templates. All user data is HTML-escaped before insertion.
 * Templates are selected by name — no raw HTML accepted from clients.
 */

function esc(s: string | number | undefined | null): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface DailySummaryData {
  profileName: string
  daysLeft: number
  readiness: number
  dueFlashcards: number
  streak: number
  weeklyHours: number
  topWeakTopics: string[]
}

function dailySummaryTemplate(data: DailySummaryData): { subject: string; html: string } {
  const weakHtml = data.topWeakTopics?.length
    ? `<p><strong>Focus areas:</strong></p><ul>${data.topWeakTopics.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
    : ''

  return {
    subject: `StudiesKit Daily: ${esc(data.daysLeft)} days until ${esc(data.profileName)}`,
    html: `
<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
  <h2>Daily Study Summary</h2>
  <p><strong>${esc(data.profileName)}</strong> — ${esc(data.daysLeft)} days left</p>
  <ul>
    <li>Readiness: ${esc(data.readiness)}%</li>
    <li>Study streak: ${esc(data.streak)} days</li>
    <li>This week: ${esc(data.weeklyHours)}h studied</li>
    <li>Flashcards due: ${esc(data.dueFlashcards)}</li>
  </ul>
  ${weakHtml}
  <p><a href="https://studieskit.com/dashboard">Open StudiesKit</a></p>
</div>`,
  }
}

interface WeeklyDigestData {
  profileName: string
  studyHours: number
  prevWeekHours: number
  questionsAnswered: number
  accuracy: number
  streak: number
  dueFlashcards: number
  daysUntilExam: number | null
  weakTopics: Array<{ name: string; mastery: number }>
  masteryChanges: Array<{ name: string; delta: number }>
}

function weeklyDigestTemplate(data: WeeklyDigestData): { subject: string; html: string } {
  const hoursDiff = data.studyHours - data.prevWeekHours
  const hoursTrend = hoursDiff > 0 ? `+${hoursDiff}h vs last week` : hoursDiff < 0 ? `${hoursDiff}h vs last week` : 'same as last week'

  const masteryLines = (data.masteryChanges || []).map(m =>
    m.delta > 0
      ? `<li style="color:#10b981">&uarr; ${esc(m.name)} +${m.delta}%</li>`
      : `<li style="color:#ef4444">&darr; ${esc(m.name)} ${m.delta}%</li>`
  ).join('')

  const weakLines = (data.weakTopics || []).map(t =>
    `<li>${esc(t.name)} (${esc(t.mastery)}%)</li>`
  ).join('')

  return {
    subject: `Your weekly study report — ${esc(data.profileName)}`,
    html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:24px;color:#1a1a2e">
  <div style="text-align:center;margin-bottom:24px">
    <img src="https://studieskit.com/favicon-48x48.png" width="32" height="32" style="border-radius:8px" />
    <h2 style="margin:8px 0 0;font-size:18px">Weekly Study Report</h2>
    <p style="color:#666;font-size:13px;margin:4px 0">${esc(data.profileName)}</p>
  </div>

  <div style="background:#f8f9fa;border-radius:12px;padding:16px;margin-bottom:16px">
    <h3 style="font-size:14px;margin:0 0 12px;color:#333">This Week</h3>
    <ul style="list-style:none;padding:0;margin:0;font-size:13px;line-height:1.8">
      <li><strong>${esc(data.studyHours)}h</strong> studied (${esc(hoursTrend)})</li>
      <li><strong>${esc(data.questionsAnswered)}</strong> questions answered (${esc(data.accuracy)}% accuracy)</li>
      <li><strong>${esc(data.streak)}</strong> day streak</li>
      ${data.dueFlashcards > 0 ? `<li><strong>${esc(data.dueFlashcards)}</strong> flashcards due</li>` : ''}
      ${data.daysUntilExam !== null ? `<li><strong>${esc(data.daysUntilExam)}</strong> days until exam</li>` : ''}
    </ul>
  </div>

  ${masteryLines ? `
  <div style="background:#f8f9fa;border-radius:12px;padding:16px;margin-bottom:16px">
    <h3 style="font-size:14px;margin:0 0 8px;color:#333">Mastery Changes</h3>
    <ul style="list-style:none;padding:0;margin:0;font-size:13px;line-height:1.6">${masteryLines}</ul>
  </div>` : ''}

  ${weakLines ? `
  <div style="background:#fff3cd;border-radius:12px;padding:16px;margin-bottom:16px">
    <h3 style="font-size:14px;margin:0 0 8px;color:#856404">Focus This Week</h3>
    <ul style="list-style:none;padding:0;margin:0;font-size:13px;line-height:1.6;color:#856404">${weakLines}</ul>
  </div>` : ''}

  <div style="text-align:center;margin-top:24px">
    <a href="https://studieskit.com/queue" style="display:inline-block;background:#10b981;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Open StudiesKit</a>
  </div>

  <p style="text-align:center;font-size:11px;color:#999;margin-top:24px">
    <a href="https://studieskit.com/settings?unsubscribe=weekly" style="color:#999">Unsubscribe from weekly digest</a>
  </p>
</div>`,
  }
}

const TEMPLATES: Record<string, (data: Record<string, unknown>) => { subject: string; html: string }> = {
  'daily-summary': (data) => dailySummaryTemplate(data as unknown as DailySummaryData),
  'weekly-digest': (data) => weeklyDigestTemplate(data as unknown as WeeklyDigestData),
}

export function renderTemplate(
  name: string,
  data: Record<string, unknown>,
): { subject: string; html: string } | null {
  const fn = TEMPLATES[name]
  if (!fn) return null
  return fn(data)
}

export const VALID_TEMPLATES = Object.keys(TEMPLATES)
