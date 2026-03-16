import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronDown, Lock } from 'lucide-react'
import type { Subject, Topic, TopicStatus } from '../../db/schema'

interface Props {
  subjects: Subject[]
  getTopicsForSubject: (subjectId: string) => Topic[]
  allTopics?: Topic[]
  showStatus?: boolean
}

const statusBadgeColors: Record<TopicStatus, string> = {
  'active': 'bg-green-500',
  'exploring': 'bg-amber-400',
  'blocked': 'bg-red-500',
  'resolved': 'bg-gray-400',
}

export function TopicTree({ subjects, getTopicsForSubject, allTopics, showStatus }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const topicMap = new Map((allTopics ?? []).map(tp => [tp.id, tp]))

  function hasUnmetPrereqs(topic: Topic): boolean {
    if (!topic.prerequisiteTopicIds || topic.prerequisiteTopicIds.length === 0) return false
    return topic.prerequisiteTopicIds.some(id => {
      const prereq = topicMap.get(id)
      return prereq && prereq.mastery < 0.6
    })
  }

  if (subjects.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-[var(--text-muted)]">{t('dashboard.knowledgeGraphEmpty')}</p>
        <Link to="/practice-exam" className="inline-block mt-2 text-sm text-[var(--accent-text)] hover:underline">
          {t('dashboard.quickActions.practiceExam')}
        </Link>
      </div>
    )
  }

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
                    {hasUnmetPrereqs(topic) && (
                      <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    )}
                    {showStatus && topic.status && (
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusBadgeColors[topic.status]}`} title={topic.status} />
                    )}
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
