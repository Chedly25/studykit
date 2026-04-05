import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronUp, ChevronDown } from 'lucide-react'
import { ACTIVITY_ICONS, ACTIVITY_COLORS } from './ActivityBlock'
import { BookOpen } from 'lucide-react'
import type { PlanDraftData, PlanDraftActivity, DraftSubject, WizardAction } from '../../hooks/useWizardDraft'

const ACTIVITY_TYPES = ['read', 'flashcards', 'practice', 'socratic', 'explain-back', 'review']

interface PlanDayViewProps {
  plan: PlanDraftData
  subjects: DraftSubject[]
  selectedDayIndex: number
  onSelectDay: (index: number) => void
  onSelectActivity: (dayIndex: number, actIndex: number) => void
  dispatch: React.Dispatch<WizardAction>
}

export function PlanDayView({
  plan, subjects, selectedDayIndex, onSelectDay, onSelectActivity, dispatch,
}: PlanDayViewProps) {
  const { t } = useTranslation()
  const [isAdding, setIsAdding] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  const [newType, setNewType] = useState('read')
  const [newDuration, setNewDuration] = useState(30)

  // Reset add-form when switching days
  useEffect(() => {
    setIsAdding(false)
    setNewTopic('')
    setNewType('read')
    setNewDuration(30)
  }, [selectedDayIndex])

  const allTopics = subjects.flatMap(s => s.topics.map(tp => tp.name))
  const day = plan.days[selectedDayIndex]
  if (!day) return null

  // Find subject color for a topic
  const getSubjectColor = (topicName: string): string | undefined => {
    for (const s of subjects) {
      if (s.topics.some(tp => tp.name === topicName)) return s.color
    }
    return undefined
  }

  const handleAddActivity = () => {
    if (!newTopic) return
    const activity: PlanDraftActivity = {
      id: crypto.randomUUID(),
      topicName: newTopic,
      activityType: newType,
      durationMinutes: newDuration,
    }
    dispatch({ type: 'ADD_PLAN_ACTIVITY', dayIndex: selectedDayIndex, activity })
    setIsAdding(false)
    setNewTopic('')
    setNewType('read')
    setNewDuration(30)
  }

  return (
    <div>
      {/* Day strip */}
      <div className="flex gap-1.5 mb-4">
        {plan.days.map((d, i) => {
          const actCount = d.activities.length
          const isSelected = i === selectedDayIndex
          return (
            <button
              key={d.date}
              onClick={() => onSelectDay(i)}
              className={`flex-1 py-2 px-1 rounded-lg text-center transition-all ${
                isSelected
                  ? 'bg-[var(--accent-text)] text-white ring-2 ring-[var(--accent-text)]/30'
                  : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)]'
              }`}
            >
              <div className="text-xs font-semibold">{d.dayLabel.slice(0, 3)}</div>
              <div className="text-[10px] opacity-70">
                {new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
              {actCount > 0 && (
                <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${
                  isSelected ? 'bg-white/70' : 'bg-[var(--accent-text)]'
                }`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Day header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">{day.dayLabel}</h3>
          <span className="text-xs text-[var(--text-muted)]">
            {day.activities.length} {day.activities.length === 1 ? 'activity' : 'activities'}
            {day.activities.length > 0 && ` · ${day.activities.reduce((s, a) => s + a.durationMinutes, 0)}m`}
          </span>
        </div>
      </div>

      {/* Activity list */}
      <div className="space-y-2">
        {day.activities.map((activity, actIndex) => {
          const Icon = ACTIVITY_ICONS[activity.activityType] ?? BookOpen
          const colorClass = ACTIVITY_COLORS[activity.activityType] ?? 'bg-[var(--bg-input)] text-[var(--text-body)]'
          const subjectColor = getSubjectColor(activity.topicName)

          return (
            <div
              key={activity.id}
              role="button"
              tabIndex={0}
              className="glass-card p-4 flex items-center gap-3 cursor-pointer hover:ring-1 hover:ring-[var(--accent-text)]/20 focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]/40 transition-all"
              onClick={() => onSelectActivity(selectedDayIndex, actIndex)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectActivity(selectedDayIndex, actIndex) } }}
            >
              {/* Subject color bar */}
              <div
                className="w-1 self-stretch rounded-full flex-shrink-0"
                style={{ backgroundColor: subjectColor ?? 'var(--accent-text)' }}
              />

              {/* Icon + info */}
              <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-heading)]">{activity.topicName}</div>
                <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                  <span className="capitalize">{activity.activityType.replace('-', ' ')}</span>
                  <span>·</span>
                  <span>{activity.durationMinutes}m</span>
                </div>
              </div>

              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                {actIndex > 0 && (
                  <button
                    onClick={() => dispatch({ type: 'REORDER_PLAN_ACTIVITY', dayIndex: selectedDayIndex, fromIndex: actIndex, direction: 'up' })}
                    className="p-1 rounded hover:bg-[var(--bg-input)] text-[var(--text-muted)]"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                )}
                {actIndex < day.activities.length - 1 && (
                  <button
                    onClick={() => dispatch({ type: 'REORDER_PLAN_ACTIVITY', dayIndex: selectedDayIndex, fromIndex: actIndex, direction: 'down' })}
                    className="p-1 rounded hover:bg-[var(--bg-input)] text-[var(--text-muted)]"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Empty state */}
        {day.activities.length === 0 && (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">
            {t('wizard.noDayActivities')}
          </div>
        )}

        {/* Add activity */}
        {isAdding ? (
          <div className="glass-card p-4 space-y-3">
            <select
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              className="w-full text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-[var(--text-body)]"
            >
              <option value="">{t('wizard.selectTopic')}</option>
              {allTopics.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="w-full text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-[var(--text-body)]"
            >
              {ACTIVITY_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={15}
                max={120}
                step={5}
                value={newDuration}
                onChange={e => setNewDuration(Number(e.target.value))}
                className="flex-1 accent-[var(--accent-text)]"
              />
              <span className="text-sm text-[var(--text-muted)] w-10 text-right">{newDuration}m</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddActivity}
                disabled={!newTopic}
                className="flex-1 text-sm py-2 rounded-lg bg-[var(--accent-text)] text-white disabled:opacity-40"
              >
                {t('wizard.add')}
              </button>
              <button
                onClick={() => { setIsAdding(false); setNewTopic(''); setNewType('read'); setNewDuration(30) }}
                className="text-sm py-2 px-4 rounded-lg text-[var(--text-muted)]"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setIsAdding(true)
              if (allTopics.length > 0 && !newTopic) setNewTopic(allTopics[0])
            }}
            className="w-full py-3 rounded-lg border border-dashed border-[var(--border-card)] text-sm text-[var(--text-muted)] hover:border-[var(--accent-text)]/50 hover:text-[var(--accent-text)] transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> {t('wizard.addActivity')}
          </button>
        )}
      </div>
    </div>
  )
}
