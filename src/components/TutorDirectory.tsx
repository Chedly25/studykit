import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessageCircle, ArrowRight } from 'lucide-react'
import type { Subject, Topic } from '../db/schema'

interface Props {
  subjects: Subject[]
  topics: Topic[]
}

export function TutorDirectory({ subjects, topics }: Props) {
  const { t } = useTranslation()
  if (subjects.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {subjects.map(subject => {
        const subjectTopics = topics.filter(t => t.subjectId === subject.id)
        const avgMastery = subjectTopics.length > 0
          ? subjectTopics.reduce((s, t) => s + t.mastery, 0) / subjectTopics.length
          : 0
        const masteryPct = Math.round(avgMastery * 100)

        return (
          <div key={subject.id} className="glass-card glass-card-hover p-4 flex flex-col gap-3">
            {/* Subject identity */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: subject.color }}
              />
              <h3 className="text-sm font-semibold text-[var(--text-heading)] truncate">{subject.name}</h3>
            </div>

            {/* Mastery bar — uses subject's own color */}
            <div>
              <div className="w-full h-2 rounded-full bg-[var(--bg-input)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${masteryPct}%`, backgroundColor: subject.color }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-[var(--text-muted)]">
                  {t('tutor.topics', { count: subjectTopics.length })}
                </span>
                <span className="text-xs font-semibold" style={{ color: subject.color }}>
                  {masteryPct}%
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-auto">
              <Link
                to={`/subject/${subject.id}`}
                className="flex-1 text-center text-xs font-medium py-2 rounded-lg bg-[var(--bg-input)] text-[var(--text-body)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors flex items-center justify-center gap-1.5"
              >
                {t('tutor.viewTopics')} <ArrowRight className="w-3 h-3" />
              </Link>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-chat-panel', {
                    detail: { subjectId: subject.id, subjectName: subject.name },
                  }))
                }}
                className="flex-1 text-center text-xs font-medium py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] hover:opacity-80 transition-opacity flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-3 h-3" /> {t('tutor.askTutor')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
