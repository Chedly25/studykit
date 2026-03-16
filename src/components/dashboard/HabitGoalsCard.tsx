import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Target, Plus, Flame, Trash2 } from 'lucide-react'
import type { HabitGoal, HabitFrequency } from '../../db/schema'

interface Props {
  goals: HabitGoal[]
  getTodayProgress: (goalId: string) => number
  onAdd: (title: string, targetValue: number, unit: string, frequency: HabitFrequency) => void
  onLog: (goalId: string, value: number) => void
  onDelete: (goalId: string) => void
}

export function HabitGoalsCard({ goals, getTodayProgress, onAdd, onLog, onDelete }: Props) {
  const { t } = useTranslation()
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTarget, setNewTarget] = useState(1)
  const [newUnit, setNewUnit] = useState('pages')
  const [newFrequency, setNewFrequency] = useState<HabitFrequency>('daily')

  const handleAdd = () => {
    if (!newTitle.trim()) return
    onAdd(newTitle.trim(), newTarget, newUnit, newFrequency)
    setNewTitle('')
    setNewTarget(1)
    setNewUnit('pages')
    setShowAdd(false)
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--accent-text)]" />
          <h3 className="font-semibold text-[var(--text-heading)]">{t('research.goals')}</h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="p-1 rounded hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)]"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 p-3 rounded-lg bg-[var(--bg-input)] space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder={t('research.goalTitle')}
            className="input-field w-full text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={newTarget}
              onChange={e => setNewTarget(Number(e.target.value))}
              min={1}
              className="input-field text-sm text-center"
              placeholder={t('research.targetValue')}
            />
            <input
              type="text"
              value={newUnit}
              onChange={e => setNewUnit(e.target.value)}
              className="input-field text-sm"
              placeholder={t('research.unit')}
            />
            <select
              value={newFrequency}
              onChange={e => setNewFrequency(e.target.value as HabitFrequency)}
              className="select-field text-sm"
            >
              <option value="daily">{t('research.daily')}</option>
              <option value="weekly">{t('research.weekly')}</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button onClick={handleAdd} className="btn-primary px-3 py-1 text-sm">{t('common.create')}</button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No goals set</p>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => {
            const today = getTodayProgress(goal.id)
            const pct = Math.min(100, Math.round((today / goal.targetValue) * 100))
            const isComplete = today >= goal.targetValue

            return (
              <div key={goal.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-body)]">{goal.title}</span>
                  <div className="flex items-center gap-2">
                    {goal.currentStreak > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-orange-500">
                        <Flame className="w-3 h-3" /> {goal.currentStreak}
                      </span>
                    )}
                    <button
                      onClick={() => onDelete(goal.id)}
                      className="p-0.5 text-[var(--text-faint)] hover:text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-[var(--border-card)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-green-500' : 'bg-[var(--accent-text)]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--text-muted)] w-20 text-right">
                    {today}/{goal.targetValue} {goal.unit}
                  </span>
                </div>
                {!isComplete && (
                  <button
                    onClick={() => onLog(goal.id, today + 1)}
                    className="text-xs text-[var(--accent-text)] hover:underline"
                  >
                    +1 {goal.unit}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
