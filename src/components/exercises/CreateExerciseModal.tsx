import { useState, useRef } from 'react'
import { X, Plus } from 'lucide-react'
import { db } from '../../db'
import { toast } from 'sonner'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import type { Topic } from '../../db/schema'

interface CreateExerciseModalProps {
  examProfileId: string
  topics: Topic[]
  onClose: () => void
  onCreated: () => void
}

export function CreateExerciseModal({ examProfileId, topics, onClose, onCreated }: CreateExerciseModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef)
  const [text, setText] = useState('')
  const [solutionText, setSolutionText] = useState('')
  const [difficulty, setDifficulty] = useState(3)
  const [topicId, setTopicId] = useState('')
  const [points, setPoints] = useState('')

  const handleSubmit = async () => {
    if (!text.trim()) return

    // Ensure a "Custom Exercises" source exists
    let source = await db.examSources.where('examProfileId').equals(examProfileId).filter(s => s.name === 'Custom Exercises').first()
    if (!source) {
      const sourceId = crypto.randomUUID()
      source = {
        id: sourceId,
        examProfileId,
        documentId: '',
        name: 'Custom Exercises',
        year: new Date().getFullYear(),
        totalExercises: 0,
        parsedAt: new Date().toISOString(),
      }
      await db.examSources.put(source)
    }

    const existing = await db.exercises.where('examSourceId').equals(source.id).count()
    const today = new Date().toISOString().slice(0, 10)

    await db.exercises.put({
      id: crypto.randomUUID(),
      examSourceId: source.id,
      examProfileId,
      exerciseNumber: existing + 1,
      text: text.trim(),
      solutionText: solutionText.trim() || undefined,
      difficulty,
      points: points ? parseInt(points, 10) : undefined,
      topicIds: JSON.stringify(topicId ? [topicId] : []),
      status: 'not_attempted',
      attemptCount: 0,
      createdAt: new Date().toISOString(),
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewDate: today,
    })

    toast.success('Exercise created')
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div ref={modalRef} className="glass-card w-full max-w-lg mx-4 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-heading)]">Add Exercise</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-body)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase">Question *</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              className="w-full rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] px-3 py-2 text-sm text-[var(--text-body)] resize-y"
              placeholder="Enter the exercise question..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase">Solution (optional)</label>
            <textarea
              value={solutionText}
              onChange={e => setSolutionText(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] px-3 py-2 text-sm text-[var(--text-body)] resize-y"
              placeholder="Enter the model answer..."
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase">Difficulty</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      d <= difficulty
                        ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                        : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase">Topic</label>
              <select
                value={topicId}
                onChange={e => setTopicId(e.target.value)}
                className="w-full text-xs bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-2 py-2 text-[var(--text-body)]"
              >
                <option value="">None</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase">Points</label>
              <input
                type="number"
                value={points}
                onChange={e => setPoints(e.target.value)}
                className="w-full text-xs bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-2 py-2 text-[var(--text-body)]"
                placeholder="—"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary px-4 py-2 rounded-lg text-sm">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
            >
              <Plus size={14} /> Add Exercise
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
