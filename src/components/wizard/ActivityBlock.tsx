import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookOpen, RotateCcw, ClipboardCheck, MessageCircle, Brain, RefreshCw,
  X, ChevronUp, ChevronDown, Clock, Pencil, Check,
} from 'lucide-react'
import type { PlanDraftActivity, DraftSubject } from '../../hooks/useWizardDraft'

const ACTIVITY_ICONS: Record<string, typeof BookOpen> = {
  read: BookOpen,
  flashcards: RotateCcw,
  practice: ClipboardCheck,
  socratic: MessageCircle,
  'explain-back': Brain,
  review: RefreshCw,
}

const ACTIVITY_COLORS: Record<string, string> = {
  read: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  flashcards: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  practice: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  socratic: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'explain-back': 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  review: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
}

const ACTIVITY_TYPES = ['read', 'flashcards', 'practice', 'socratic', 'explain-back', 'review']

interface ActivityBlockProps {
  activity: PlanDraftActivity
  subjects: DraftSubject[]
  canMoveUp: boolean
  canMoveDown: boolean
  onUpdate: (updates: Partial<Omit<PlanDraftActivity, 'id'>>) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function ActivityBlock({
  activity, subjects, canMoveUp, canMoveDown,
  onUpdate, onDelete, onMoveUp, onMoveDown,
}: ActivityBlockProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [editTopic, setEditTopic] = useState(activity.topicName)
  const [editType, setEditType] = useState(activity.activityType)
  const [editDuration, setEditDuration] = useState(activity.durationMinutes)

  // Exit edit mode if the activity is externally updated (e.g. by AI agent)
  useEffect(() => {
    if (isEditing) {
      setIsEditing(false)
    }
    setEditTopic(activity.topicName)
    setEditType(activity.activityType)
    setEditDuration(activity.durationMinutes)
  // Only trigger on external activity changes, not our own edits
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.topicName, activity.activityType, activity.durationMinutes])

  const Icon = ACTIVITY_ICONS[activity.activityType] ?? BookOpen
  const colorClass = ACTIVITY_COLORS[activity.activityType] ?? 'bg-[var(--bg-input)] text-[var(--text-body)]'

  const allTopics = subjects.flatMap(s => s.topics.map(t => t.name))

  const handleSave = () => {
    onUpdate({ topicName: editTopic, activityType: editType, durationMinutes: editDuration })
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="rounded-lg border border-[var(--accent-text)]/30 bg-[var(--bg-card)] p-2.5 space-y-2">
        <select
          value={editTopic}
          onChange={e => setEditTopic(e.target.value)}
          className="w-full text-xs bg-[var(--bg-input)] border border-[var(--border-card)] rounded px-2 py-1 text-[var(--text-body)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
        >
          {allTopics.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <div className="flex flex-wrap gap-1">
          {ACTIVITY_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setEditType(type)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                editType === type
                  ? ACTIVITY_COLORS[type]
                  : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-[var(--text-muted)]" />
          <input
            type="range"
            min={15}
            max={120}
            step={5}
            value={editDuration}
            onChange={e => setEditDuration(Number(e.target.value))}
            className="flex-1 accent-[var(--accent-text)]"
          />
          <span className="text-xs text-[var(--text-muted)] w-10 text-right">{editDuration}m</span>
        </div>

        <div className="flex justify-end gap-1">
          <button onClick={() => setIsEditing(false)} className="px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} className="px-2 py-1 text-xs text-[var(--accent-text)] font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> {t('common.save')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`group rounded-lg p-2 ${colorClass} transition-all hover:ring-1 hover:ring-[var(--accent-text)]/20`}>
      <div className="flex items-start gap-1.5">
        <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{activity.topicName}</div>
          <div className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5">
            <span>{activity.activityType}</span>
            <span>·</span>
            <span>{activity.durationMinutes}m</span>
          </div>
        </div>

        {/* Actions — visible on hover */}
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setIsEditing(true)} className="p-0.5 rounded hover:bg-white/20">
            <Pencil className="w-2.5 h-2.5" />
          </button>
          {canMoveUp && (
            <button onClick={onMoveUp} className="p-0.5 rounded hover:bg-white/20">
              <ChevronUp className="w-2.5 h-2.5" />
            </button>
          )}
          {canMoveDown && (
            <button onClick={onMoveDown} className="p-0.5 rounded hover:bg-white/20">
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          )}
          <button onClick={onDelete} className="p-0.5 rounded hover:bg-red-500/20">
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
