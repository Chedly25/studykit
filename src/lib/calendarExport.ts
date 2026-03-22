/**
 * ICS calendar export — generates RFC 5545 .ics files from study plan days.
 */
import type { StudyPlanDay } from '../db/schema'

interface StudyActivity {
  topicName: string
  activityType: string
  durationMinutes: number
  completed: boolean
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function formatICSDate(date: string, hour: number, minute: number): string {
  // Format: YYYYMMDDTHHMMSS (local time)
  const d = date.replace(/-/g, '')
  const h = String(hour).padStart(2, '0')
  const m = String(minute).padStart(2, '0')
  return `${d}T${h}${m}00`
}

function addMinutes(hour: number, minute: number, addMin: number): [number, number] {
  const totalMin = hour * 60 + minute + addMin
  return [Math.floor(totalMin / 60), totalMin % 60]
}

export function generateICS(
  planDays: StudyPlanDay[],
  profileName: string,
  startHour: number = 9,
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudiesKit//Study Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(profileName)} - Study Plan`,
  ]

  for (const day of planDays) {
    let activities: StudyActivity[]
    try {
      activities = JSON.parse(day.activities)
    } catch {
      continue
    }

    let currentHour = startHour
    let currentMinute = 0

    for (let i = 0; i < activities.length; i++) {
      const act = activities[i]
      const startTime = formatICSDate(day.date, currentHour, currentMinute)
      const [endH, endM] = addMinutes(currentHour, currentMinute, act.durationMinutes)
      const endTime = formatICSDate(day.date, endH, endM)

      const activityLabel: Record<string, string> = {
        read: 'Read',
        flashcards: 'Flashcards',
        practice: 'Practice',
        socratic: 'Socratic Session',
        'explain-back': 'Explain Back',
        review: 'Review',
      }

      const summary = `${act.topicName} — ${activityLabel[act.activityType] ?? act.activityType}`

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${day.id}-${i}@studieskit.com`)
      lines.push(`DTSTART:${startTime}`)
      lines.push(`DTEND:${endTime}`)
      lines.push(`SUMMARY:${escapeICS(summary)}`)
      lines.push(`DESCRIPTION:${escapeICS(`StudiesKit study plan — ${profileName}\\n${act.topicName}: ${activityLabel[act.activityType] ?? act.activityType} (${act.durationMinutes} min)`)}`)
      lines.push(`STATUS:${act.completed ? 'COMPLETED' : 'CONFIRMED'}`)
      lines.push('END:VEVENT')

      // Advance clock: 5 min break between activities
      ;[currentHour, currentMinute] = addMinutes(endH, endM, 5)
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadICS(icsContent: string, fileName: string) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
