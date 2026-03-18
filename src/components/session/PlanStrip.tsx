import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import type { StudyPlanDay } from '../../db/schema'

interface StudyActivity {
  topicName: string
  activityType: string
  durationMinutes: number
  completed: boolean
}

interface PlanStripProps {
  todaysPlan: StudyPlanDay | null
  currentTopicName: string
  onToggleActivity: (dayId: string, index: number) => void
}

export function PlanStrip({ todaysPlan, currentTopicName, onToggleActivity }: PlanStripProps) {
  const navigate = useNavigate()

  if (!todaysPlan) return null

  let activities: StudyActivity[]
  try {
    activities = JSON.parse(todaysPlan.activities)
  } catch {
    return null
  }

  if (activities.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--border-card)] overflow-x-auto scrollbar-hide">
      <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider flex-shrink-0 mr-1">
        Today
      </span>
      {activities.map((act, i) => {
        const isCurrent = act.topicName.toLowerCase() === currentTopicName.toLowerCase()
        return (
          <button
            key={i}
            onClick={() => {
              if (isCurrent) {
                onToggleActivity(todaysPlan.id, i)
              } else {
                navigate(`/session?topic=${encodeURIComponent(act.topicName)}`)
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
              isCurrent
                ? 'bg-[var(--accent-text)] text-white'
                : act.completed
                ? 'bg-[var(--bg-input)] text-[var(--text-muted)] line-through'
                : 'bg-[var(--bg-input)] text-[var(--text-body)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)]'
            }`}
          >
            {act.completed && <Check className="w-3 h-3" />}
            <span className="truncate max-w-[120px]">{act.topicName}</span>
            <span className="opacity-60">{act.durationMinutes}m</span>
          </button>
        )
      })}
    </div>
  )
}
