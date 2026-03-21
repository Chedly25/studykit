import { Link } from 'react-router-dom'
import { BookOpen, ArrowRight } from 'lucide-react'
import type { Subject, Topic, Chapter } from '../../db/schema'

interface SubjectGridProps {
  subjects: Subject[]
  topics: Topic[]
  getChaptersForSubject: (subjectId: string) => Chapter[]
}

function masteryColor(mastery: number): string {
  if (mastery >= 0.7) return 'bg-green-500'
  if (mastery >= 0.3) return 'bg-yellow-500'
  return 'bg-red-500'
}

function masteryTextColor(mastery: number): string {
  if (mastery >= 0.7) return 'text-green-600'
  if (mastery >= 0.3) return 'text-yellow-600'
  return 'text-red-500'
}

export function SubjectGrid({ subjects, topics, getChaptersForSubject }: SubjectGridProps) {
  if (subjects.length === 0) {
    return (
      <div className="text-center py-8">
        <BookOpen className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-muted)]">No subjects yet. Create a project to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 mb-4">
      {subjects.map(subject => {
        const subjectChapters = getChaptersForSubject(subject.id)
        const subjectTopics = topics.filter(t => t.subjectId === subject.id)
        const avgMastery = subjectTopics.length > 0
          ? subjectTopics.reduce((s, t) => s + t.mastery, 0) / subjectTopics.length
          : 0
        const masteryPct = Math.round(avgMastery * 100)

        return (
          <Link
            key={subject.id}
            to={`/subject/${subject.id}`}
            className="glass-card flex items-center gap-3 p-4 hover:bg-[var(--bg-input)]/50 transition-colors block"
          >
            <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--text-heading)]">{subject.name}</h3>
              <span className="text-xs text-[var(--text-muted)]">
                {subjectChapters.length} chapter{subjectChapters.length !== 1 ? 's' : ''} · {subjectTopics.length} topic{subjectTopics.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-20 h-2 rounded-full bg-[var(--bg-input)] overflow-hidden">
                <div className={`h-full rounded-full ${masteryColor(avgMastery)} transition-all`} style={{ width: `${masteryPct}%` }} />
              </div>
              <span className={`text-xs font-semibold w-8 text-right ${masteryTextColor(avgMastery)}`}>{masteryPct}%</span>
              <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
