/**
 * Compact 7-day SRS schedule card showing upcoming review load.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar } from 'lucide-react'
import { useWeeklySchedule, type DaySchedule } from '../../hooks/useWeeklySchedule'

interface Props {
  examProfileId?: string
}

export function WeeklyScheduleCard({ examProfileId }: Props) {
  const { t } = useTranslation()
  const days = useWeeklySchedule(examProfileId)
  const [hoveredDay, setHoveredDay] = useState<DaySchedule | null>(null)

  if (days.length === 0) return null

  const totalWeek = days.reduce((sum, d) => sum + d.total, 0)
  if (totalWeek === 0) return null

  const maxCount = Math.max(...days.map(d => d.total), 1)

  return (
    <div className="glass-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> {t('dashboard.thisWeek', 'This Week')}
        </h3>
        <span className="text-xs text-[var(--text-faint)]">
          {t('dashboard.itemsDue', { count: totalWeek })}
        </span>
      </div>

      <div className="flex items-end gap-2 h-16">
        {days.map(day => {
          const pct = (day.total / maxCount) * 100
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1 cursor-default"
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              {/* Bar */}
              <div className="w-full flex flex-col justify-end h-10">
                {day.total > 0 ? (
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      day.isToday ? 'bg-[var(--accent-text)]' : 'bg-[var(--accent-text)]/40'
                    }`}
                    style={{ height: `${Math.max(pct, 8)}%` }}
                  />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--border-card)] mx-auto" />
                )}
              </div>
              {/* Count */}
              <span className={`text-[10px] font-medium ${
                day.isToday ? 'text-[var(--accent-text)]' : 'text-[var(--text-faint)]'
              }`}>
                {day.total > 0 ? day.total : ''}
              </span>
              {/* Day label */}
              <span className={`text-[10px] ${
                day.isToday ? 'text-[var(--accent-text)] font-bold' : 'text-[var(--text-faint)]'
              }`}>
                {day.dayLabel}
              </span>
            </div>
          )
        })}
      </div>

      {/* Hover tooltip */}
      {hoveredDay && hoveredDay.total > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--border-card)] text-xs text-[var(--text-muted)] flex gap-3 animate-fade-in">
          <span>{hoveredDay.dayLabel}</span>
          {hoveredDay.flashcards > 0 && <span className="text-purple-500">{hoveredDay.flashcards} {t('dashboard.scheduleFlashcards', 'flashcards')}</span>}
          {hoveredDay.exercises > 0 && <span className="text-orange-500">{hoveredDay.exercises} {t('dashboard.scheduleExercises', 'exercises')}</span>}
          {hoveredDay.concepts > 0 && <span className="text-blue-500">{hoveredDay.concepts} {t('dashboard.scheduleConcepts', 'concepts')}</span>}
        </div>
      )}
    </div>
  )
}
