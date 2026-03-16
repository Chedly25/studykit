import { useState, useEffect } from 'react'
import { X, Link2 } from 'lucide-react'
import { db } from '../../db'
import type { Topic } from '../../db/schema'

interface Props {
  open: boolean
  onClose: () => void
  topic: Topic | null
  examProfileId: string
}

export function DependencyEditor({ open, onClose, topic, examProfileId }: Props) {
  const [allTopics, setAllTopics] = useState<Topic[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open || !topic) return
    db.topics.where('examProfileId').equals(examProfileId).toArray().then(topics => {
      setAllTopics(topics.filter(t => t.id !== topic.id))
      setSelected(new Set(topic.prerequisiteTopicIds ?? []))
    })
  }, [open, topic, examProfileId])

  if (!open || !topic) return null

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const save = async () => {
    await db.topics.update(topic.id, { prerequisiteTopicIds: [...selected] })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-card w-full max-w-md p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-heading)] flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[var(--accent-text)]" />
            Prerequisites for "{topic.name}"
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-heading)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-3">
          Select topics that should be mastered before studying "{topic.name}".
        </p>
        <div className="flex-1 overflow-y-auto space-y-1">
          {allTopics.map(t => (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                selected.has(t.id)
                  ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                  : 'hover:bg-[var(--bg-input)] text-[var(--text-body)]'
              }`}
            >
              <span>{t.name}</span>
              <span className="text-xs">{Math.round(t.mastery * 100)}%</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary px-4 py-1.5 text-sm">Cancel</button>
          <button onClick={save} className="btn-primary px-4 py-1.5 text-sm">Save</button>
        </div>
      </div>
    </div>
  )
}
