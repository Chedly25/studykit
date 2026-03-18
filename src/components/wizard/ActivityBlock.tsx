import {
  BookOpen, RotateCcw, ClipboardCheck, MessageCircle, Brain, RefreshCw,
} from 'lucide-react'
import type { PlanDraftActivity } from '../../hooks/useWizardDraft'

export const ACTIVITY_ICONS: Record<string, typeof BookOpen> = {
  read: BookOpen,
  flashcards: RotateCcw,
  practice: ClipboardCheck,
  socratic: MessageCircle,
  'explain-back': Brain,
  review: RefreshCw,
}

export const ACTIVITY_COLORS: Record<string, string> = {
  read: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  flashcards: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  practice: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  socratic: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'explain-back': 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  review: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
}

interface ActivityBlockProps {
  activity: PlanDraftActivity
  onSelect: () => void
}

export function ActivityBlock({ activity, onSelect }: ActivityBlockProps) {
  const Icon = ACTIVITY_ICONS[activity.activityType] ?? BookOpen
  const colorClass = ACTIVITY_COLORS[activity.activityType] ?? 'bg-[var(--bg-input)] text-[var(--text-body)]'

  return (
    <div
      role="button"
      tabIndex={0}
      className={`rounded-lg p-2 ${colorClass} transition-all hover:ring-1 hover:ring-[var(--accent-text)]/20 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]/40`}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
    >
      <div className="flex items-start gap-1.5">
        <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium line-clamp-2">{activity.topicName}</div>
          <div className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5">
            <span>{activity.activityType}</span>
            <span>·</span>
            <span>{activity.durationMinutes}m</span>
          </div>
        </div>
      </div>
    </div>
  )
}
