import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { ActivityBlock } from './ActivityBlock'
import type { PlanDraftData, PlanDraftActivity, DraftSubject, WizardAction } from '../../hooks/useWizardDraft'

const ACTIVITY_TYPES = ['read', 'flashcards', 'practice', 'socratic', 'explain-back', 'review']

interface PlanWeekGridProps {
  plan: PlanDraftData
  subjects: DraftSubject[]
  dispatch: React.Dispatch<WizardAction>
  onSelectActivity: (dayIndex: number, actIndex: number) => void
}

export function PlanWeekGrid({ plan, subjects, dispatch, onSelectActivity }: PlanWeekGridProps) {
  const { t } = useTranslation()
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const [newTopic, setNewTopic] = useState('')
  const [newType, setNewType] = useState('read')
  const [newDuration, setNewDuration] = useState(30)

  const allTopics = subjects.flatMap(s => s.topics.map(tp => tp.name))

  const handleAddActivity = (dayIndex: number) => {
    if (!newTopic) return
    const activity: PlanDraftActivity = {
      id: crypto.randomUUID(),
      topicName: newTopic,
      activityType: newType,
      durationMinutes: newDuration,
    }
    dispatch({ type: 'ADD_PLAN_ACTIVITY', dayIndex, activity })
    setAddingDay(null)
    setNewTopic('')
    setNewType('read')
    setNewDuration(30)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
      {plan.days.map((day, dayIndex) => {
        const totalMin = day.activities.reduce((sum, a) => sum + a.durationMinutes, 0)
        const isAdding = addingDay === dayIndex

        return (
          <div key={day.date} className="glass-card p-3 min-h-[120px] flex flex-col">
            {/* Day header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div>
                <div className="text-xs font-semibold text-[var(--text-heading)]">{day.dayLabel}</div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
              {totalMin > 0 && (
                <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-input)] px-1.5 py-0.5 rounded">
                  {totalMin}m
                </span>
              )}
            </div>

            {/* Activity blocks */}
            <div className="flex-1 space-y-1.5">
              {day.activities.map((activity, actIndex) => (
                <ActivityBlock
                  key={activity.id}
                  activity={activity}
                  onSelect={() => onSelectActivity(dayIndex, actIndex)}
                />
              ))}

              {/* Add activity inline form */}
              {isAdding ? (
                <div className="rounded-lg border border-[var(--accent-text)]/30 p-2 space-y-1.5 bg-[var(--bg-card)]">
                  <select
                    value={newTopic}
                    onChange={e => setNewTopic(e.target.value)}
                    className="w-full text-[10px] bg-[var(--bg-input)] border border-[var(--border-card)] rounded px-1.5 py-1 text-[var(--text-body)]"
                  >
                    <option value="">{t('wizard.selectTopic', 'Select topic...')}</option>
                    {allTopics.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    className="w-full text-[10px] bg-[var(--bg-input)] border border-[var(--border-card)] rounded px-1.5 py-1 text-[var(--text-body)]"
                  >
                    {ACTIVITY_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1 text-[10px]">
                    <input
                      type="range"
                      min={15}
                      max={120}
                      step={5}
                      value={newDuration}
                      onChange={e => setNewDuration(Number(e.target.value))}
                      className="flex-1 accent-[var(--accent-text)]"
                    />
                    <span className="text-[var(--text-muted)] w-8 text-right">{newDuration}m</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAddActivity(dayIndex)}
                      disabled={!newTopic}
                      className="flex-1 text-[10px] py-1 rounded bg-[var(--accent-text)] text-white disabled:opacity-40"
                    >
                      {t('wizard.add', 'Add')}
                    </button>
                    <button
                      onClick={() => { setAddingDay(null); setNewTopic(''); setNewType('read'); setNewDuration(30) }}
                      className="text-[10px] py-1 px-2 rounded text-[var(--text-muted)]"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNewTopic(allTopics[0] ?? '')
                    setNewType('read')
                    setNewDuration(30)
                    setAddingDay(dayIndex)
                  }}
                  className="w-full py-1.5 rounded-lg border border-dashed border-[var(--border-card)] text-[10px] text-[var(--text-muted)] hover:border-[var(--accent-text)]/50 hover:text-[var(--accent-text)] transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
