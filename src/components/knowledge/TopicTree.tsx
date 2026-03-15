import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { Subject, Topic } from '../../db/schema'

interface Props {
  subjects: Subject[]
  getTopicsForSubject: (subjectId: string) => Topic[]
}

export function TopicTree({ subjects, getTopicsForSubject }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-1">
      {subjects.map(subject => {
        const topics = getTopicsForSubject(subject.id)
        const isOpen = expanded.has(subject.id)

        return (
          <div key={subject.id}>
            <button
              onClick={() => toggle(subject.id)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-input)] transition-colors"
            >
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                : <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              }
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
              <span className="text-sm font-medium text-[var(--text-heading)] flex-1 text-left">{subject.name}</span>
              <MasteryBar value={subject.mastery} />
              <span className="text-xs text-[var(--text-muted)] w-10 text-right">{Math.round(subject.mastery * 100)}%</span>
            </button>

            {isOpen && (
              <div className="ml-9 space-y-0.5 pb-1">
                {topics.map(topic => (
                  <div key={topic.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[var(--bg-input)]/50">
                    <span className="text-sm text-[var(--text-body)] flex-1">{topic.name}</span>
                    <MasteryBar value={topic.mastery} />
                    <span className="text-xs text-[var(--text-muted)] w-10 text-right">{Math.round(topic.mastery * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MasteryBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'var(--accent-text)' : pct >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="w-16 h-1.5 rounded-full bg-[var(--border-card)] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}
