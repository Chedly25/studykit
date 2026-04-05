import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Clock, BookOpen } from 'lucide-react'
import { ACTIVITY_ICONS, ACTIVITY_COLORS } from './ActivityBlock'
import type { PlanDraftActivity, PlanDraftData, DraftSubject, WizardAction } from '../../hooks/useWizardDraft'

const ACTIVITY_TYPES = ['read', 'flashcards', 'practice', 'socratic', 'explain-back', 'review']

interface ActivityDetailDialogProps {
  activity: PlanDraftActivity
  dayIndex: number
  activityIndex: number
  plan: PlanDraftData
  subjects: DraftSubject[]
  dispatch: React.Dispatch<WizardAction>
  onClose: () => void
}

export function ActivityDetailDialog({
  activity, dayIndex, activityIndex, plan, subjects, dispatch, onClose,
}: ActivityDetailDialogProps) {
  const { t } = useTranslation()
  const [editTopic, setEditTopic] = useState(activity.topicName)
  const [editType, setEditType] = useState(activity.activityType)
  const [editDuration, setEditDuration] = useState(activity.durationMinutes)

  const allTopics = subjects.flatMap(s => s.topics.map(tp => tp.name))

  const handleTopicChange = (topic: string) => {
    setEditTopic(topic)
    dispatch({ type: 'UPDATE_PLAN_ACTIVITY', dayIndex, activityIndex, updates: { topicName: topic } })
  }

  const handleTypeChange = (type: string) => {
    setEditType(type)
    dispatch({ type: 'UPDATE_PLAN_ACTIVITY', dayIndex, activityIndex, updates: { activityType: type } })
  }

  const handleDurationChange = (dur: number) => {
    setEditDuration(dur)
    dispatch({ type: 'UPDATE_PLAN_ACTIVITY', dayIndex, activityIndex, updates: { durationMinutes: dur } })
  }

  const handleMoveToDay = (toDayIndex: number) => {
    if (toDayIndex === dayIndex) return
    dispatch({ type: 'MOVE_PLAN_ACTIVITY', fromDayIndex: dayIndex, fromActivityIndex: activityIndex, toDayIndex })
    onClose()
  }

  const handleDelete = () => {
    dispatch({ type: 'REMOVE_PLAN_ACTIVITY', dayIndex, activityIndex })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-card w-full max-w-md mx-4 p-6 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-[var(--text-heading)]">
            {t('wizard.editActivity')}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Topic selector */}
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
          {t('wizard.topic')}
        </label>
        <select
          value={editTopic}
          onChange={e => handleTopicChange(e.target.value)}
          className="w-full text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-[var(--text-body)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)] mb-4"
        >
          {allTopics.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {/* Activity type pills */}
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
          {t('wizard.activityType')}
        </label>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {ACTIVITY_TYPES.map(type => {
            const Icon = ACTIVITY_ICONS[type] ?? BookOpen
            const isActive = editType === type
            return (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? ACTIVITY_COLORS[type]
                    : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {type}
              </button>
            )
          })}
        </div>

        {/* Duration slider */}
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
          {t('wizard.duration')}
        </label>
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="range"
            min={15}
            max={180}
            step={5}
            value={editDuration}
            onChange={e => handleDurationChange(Number(e.target.value))}
            className="flex-1 accent-[var(--accent-text)]"
          />
          <span className="text-sm font-medium text-[var(--text-body)] w-12 text-right">{editDuration}m</span>
        </div>

        {/* Move to day */}
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
          {t('wizard.moveToDay')}
        </label>
        <div className="flex gap-1.5 mb-6">
          {plan.days.map((day, i) => (
            <button
              key={day.date}
              onClick={() => handleMoveToDay(i)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                i === dayIndex
                  ? 'bg-[var(--accent-text)] text-white'
                  : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)]'
              }`}
            >
              {day.dayLabel.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
          >
            {t('wizard.deleteActivity')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-text)] text-white hover:opacity-90 transition-opacity"
          >
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  )
}
