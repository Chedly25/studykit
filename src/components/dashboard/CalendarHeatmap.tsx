import type { DailyStudyLog } from '../../db/schema'

interface Props {
  dailyLogs: DailyStudyLog[]
}

export function CalendarHeatmap({ dailyLogs }: Props) {
  const today = new Date()
  const days: Array<{ date: string; seconds: number }> = []

  for (let i = 34; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const log = dailyLogs.find(l => l.date === dateStr)
    days.push({ date: dateStr, seconds: log?.totalSeconds ?? 0 })
  }

  const getColor = (seconds: number): string => {
    if (seconds === 0) return 'var(--border-card)'
    if (seconds < 1800) return 'var(--accent-text-dim, rgba(var(--accent-rgb, 99, 102, 241), 0.3))'
    if (seconds < 3600) return 'var(--accent-text-mid, rgba(var(--accent-rgb, 99, 102, 241), 0.6))'
    return 'var(--accent-text)'
  }

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-card)]">
      <div className="text-xs text-[var(--text-muted)] mb-2">Last 35 days</div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map(day => (
          <div
            key={day.date}
            className="aspect-square rounded-sm transition-colors"
            style={{ backgroundColor: getColor(day.seconds) }}
            title={`${day.date}: ${day.seconds > 0 ? Math.round(day.seconds / 60) + 'm' : 'No activity'}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--text-faint)]">
        <span>Less</span>
        {[0, 900, 2700, 4500].map((s, i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getColor(s) }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
