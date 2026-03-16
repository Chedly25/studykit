import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flag, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import type { Milestone, MilestoneStatus } from '../../db/schema'

interface Props {
  milestones: Milestone[]
  doneCount: number
  daysUntilNext: number | null
  onAdd: (title: string, description: string, targetDate?: string) => void
  onUpdate: (id: string, updates: { status?: MilestoneStatus }) => void
}

const statusColors: Record<MilestoneStatus, string> = {
  'pending': 'bg-gray-400',
  'in-progress': 'bg-blue-500',
  'done': 'bg-green-500',
}

// statusLabels reserved for future use with i18n
void ({ 'pending': 'Pending', 'in-progress': 'In Progress', 'done': 'Done' })

export function MilestoneTrackerCard({ milestones, doneCount, daysUntilNext, onAdd, onUpdate }: Props) {
  const { t } = useTranslation()
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [expanded, setExpanded] = useState(false)

  const total = milestones.length
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const handleAdd = () => {
    if (!newTitle.trim()) return
    onAdd(newTitle.trim(), '', newDate || undefined)
    setNewTitle('')
    setNewDate('')
    setShowAdd(false)
  }

  const cycleStatus = (m: Milestone) => {
    const next: Record<MilestoneStatus, MilestoneStatus> = {
      'pending': 'in-progress',
      'in-progress': 'done',
      'done': 'pending',
    }
    onUpdate(m.id, { status: next[m.status] })
  }

  const visibleMilestones = expanded ? milestones : milestones.slice(0, 3)

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-[var(--accent-text)]" />
          <h3 className="font-semibold text-[var(--text-heading)]">{t('research.milestones')}</h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="p-1 rounded hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
            <span>{doneCount}/{total} {t('common.done').toLowerCase()}</span>
            {daysUntilNext !== null && (
              <span>{t('research.nextMilestone', { days: daysUntilNext })}</span>
            )}
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--border-card)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent-text)] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mb-3 p-3 rounded-lg bg-[var(--bg-input)] space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder={t('research.milestoneTitle')}
            className="input-field w-full text-sm"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="input-field flex-1 text-sm"
            />
            <button onClick={handleAdd} className="btn-primary px-3 py-1 text-sm">
              {t('common.create')}
            </button>
          </div>
        </div>
      )}

      {/* Milestone list */}
      {total === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">{t('research.noMilestones')}</p>
      ) : (
        <div className="space-y-1.5">
          {visibleMilestones.map(m => (
            <button
              key={m.id}
              onClick={() => cycleStatus(m)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--bg-input)] transition-colors text-left"
            >
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColors[m.status]}`} />
              <span className={`text-sm flex-1 ${m.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-body)]'}`}>
                {m.title}
              </span>
              {m.targetDate && (
                <span className="text-xs text-[var(--text-faint)]">{m.targetDate}</span>
              )}
            </button>
          ))}
          {milestones.length > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] py-1"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Show less' : `${milestones.length - 3} more`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
