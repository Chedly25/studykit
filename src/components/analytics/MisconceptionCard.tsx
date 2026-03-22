/**
 * Misconception graph display — shows active misconceptions grouped by topic.
 */
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertCircle, Check, Dumbbell, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '../../db'

interface Props {
  examProfileId: string
}

export function MisconceptionCard({ examProfileId }: Props) {
  const [isEnqueuing, setIsEnqueuing] = useState(false)

  const handleGenerateExercises = async () => {
    setIsEnqueuing(true)
    try {
      const now = new Date().toISOString()
      await db.backgroundJobs.put({
        id: crypto.randomUUID(),
        examProfileId,
        type: 'misconception-exercise',
        status: 'queued',
        config: JSON.stringify({ examProfileId, maxMisconceptions: 3 }),
        completedStepIds: '[]',
        stepResults: '{}',
        totalSteps: 3,
        completedStepCount: 0,
        currentStepName: '',
        createdAt: now,
        updatedAt: now,
      })
      toast.success('Generating targeted exercises — they\'ll appear in your queue soon')
    } catch {
      toast.error('Failed to start exercise generation')
    } finally {
      setIsEnqueuing(false)
    }
  }

  const misconceptions = useLiveQuery(
    () => db.misconceptions.where('examProfileId').equals(examProfileId).toArray(),
    [examProfileId],
  ) ?? []

  const topics = useLiveQuery(
    () => db.topics.where('examProfileId').equals(examProfileId).toArray(),
    [examProfileId],
  ) ?? []

  if (misconceptions.length === 0) return null

  const topicMap = new Map(topics.map(t => [t.id, t.name]))

  // Group by topic, sort by occurrence count
  const byTopic = new Map<string, typeof misconceptions>()
  for (const m of misconceptions) {
    const name = topicMap.get(m.topicId) ?? 'Unknown'
    if (!byTopic.has(name)) byTopic.set(name, [])
    byTopic.get(name)!.push(m)
  }

  // Sort groups by total unresolved misconceptions
  const sortedGroups = [...byTopic.entries()].sort((a, b) => {
    const unresolvedA = a[1].filter(m => !m.resolvedAt).length
    const unresolvedB = b[1].filter(m => !m.resolvedAt).length
    return unresolvedB - unresolvedA
  })

  const unresolvedCount = misconceptions.filter(m => !m.resolvedAt).length

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <h3 className="text-sm font-bold text-[var(--text-heading)]">Misconceptions</h3>
        <span className="text-xs text-[var(--text-muted)] flex-1">
          {unresolvedCount} active, {misconceptions.length - unresolvedCount} resolved
        </span>
        {unresolvedCount > 0 && (
          <button
            onClick={handleGenerateExercises}
            disabled={isEnqueuing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[var(--accent-bg)] text-[var(--accent-text)] hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isEnqueuing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Dumbbell className="w-3 h-3" />}
            Generate exercises
          </button>
        )}
      </div>

      <div className="space-y-4">
        {sortedGroups.slice(0, 5).map(([topicName, items]) => (
          <div key={topicName}>
            <p className="text-xs font-semibold text-[var(--text-heading)] mb-1">{topicName}</p>
            <div className="space-y-1">
              {items
                .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
                .slice(0, 3)
                .map(m => (
                  <div
                    key={m.id}
                    className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
                      m.resolvedAt
                        ? 'bg-emerald-500/5 text-[var(--text-muted)]'
                        : 'bg-red-500/5 text-[var(--text-body)]'
                    }`}
                  >
                    {m.resolvedAt
                      ? <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                      : <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <span className={m.resolvedAt ? 'line-through' : ''}>{m.description}</span>
                      <span className="text-[var(--text-faint)] ml-2">
                        ({m.occurrenceCount}x)
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
