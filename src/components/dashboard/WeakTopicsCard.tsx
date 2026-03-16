import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Topic, Subject } from '../../db/schema'

interface Props {
  topics: Topic[]
  subjects: Subject[]
}

export function WeakTopicsCard({ topics, subjects }: Props) {
  const { t } = useTranslation()
  const subjectMap = new Map(subjects.map(s => [s.id, s]))

  if (topics.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="font-semibold text-[var(--text-heading)] mb-2">{t('dashboard.weakTopics')}</h3>
        <p className="text-sm text-[var(--text-muted)]">{t('dashboard.weakTopicsEmpty')}</p>
        <Link to="/practice-exam" className="inline-block mt-2 text-sm text-[var(--accent-text)] hover:underline">
          {t('dashboard.quickActions.practiceExam')}
        </Link>
      </div>
    )
  }

  return (
    <div className="glass-card p-4">
      <h3 className="font-semibold text-[var(--text-heading)] mb-3">{t('dashboard.weakTopics')}</h3>
      <div className="space-y-2.5">
        {topics.map(topic => {
          const pct = Math.round(topic.mastery * 100)
          const color = pct >= 50 ? '#f59e0b' : '#ef4444'
          const subject = subjectMap.get(topic.subjectId)

          return (
            <div key={topic.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--text-body)] truncate">
                  {topic.name}
                  {subject && <span className="text-[var(--text-faint)]"> &middot; {subject.name}</span>}
                </span>
                <span className="text-[var(--text-muted)] ml-2">{pct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--border-card)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
