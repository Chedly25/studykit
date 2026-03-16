import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Calendar, Check } from 'lucide-react'
import type { StudyPlanDay } from '../../db/schema'

interface StudyActivity {
  topicName: string
  activityType: string
  durationMinutes: number
  completed: boolean
}

interface Props {
  todaysPlan: StudyPlanDay | null
  onToggleActivity: (dayId: string, index: number) => void
  replanSuggestion?: string | null
  onReplan?: () => void
}

export function StudyPlanCard({ todaysPlan, onToggleActivity, replanSuggestion, onReplan }: Props) {
  const { t } = useTranslation()
  if (!todaysPlan) return null

  const activities: StudyActivity[] = JSON.parse(todaysPlan.activities)
  const completed = activities.filter(a => a.completed).length
  const total = activities.length

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-[var(--text-heading)] flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--accent-text)]" /> {t('dashboard.todaysPlan')}
        </h3>
        <span className="text-xs text-[var(--text-muted)]">{completed}/{total} {t('ai.completed').toLowerCase()}</span>
      </div>

      <div className="space-y-1.5">
        {activities.map((act, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => onToggleActivity(todaysPlan.id, i)}
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                act.completed
                  ? 'bg-[var(--accent-text)] border-[var(--accent-text)]'
                  : 'border-[var(--border-card)]'
              }`}
            >
              {act.completed && <Check className="w-2.5 h-2.5 text-white" />}
            </button>
            <span className={`text-sm flex-1 ${act.completed ? 'line-through text-[var(--text-faint)]' : 'text-[var(--text-body)]'}`}>
              {act.topicName}
            </span>
            <span className="text-xs text-[var(--text-faint)]">
              {act.activityType}
            </span>
          </div>
        ))}
      </div>

      {replanSuggestion && onReplan && (
        <div className="mt-2 p-2 rounded-lg bg-amber-500/10 text-xs">
          <span className="text-amber-600">{replanSuggestion}</span>
          <button onClick={onReplan} className="ml-2 text-[var(--accent-text)] hover:underline font-medium">Replan</button>
        </div>
      )}

      <Link to="/study-plan" className="text-xs text-[var(--accent-text)] hover:underline mt-3 block">
        {t('ai.studyPlan')}
      </Link>
    </div>
  )
}
