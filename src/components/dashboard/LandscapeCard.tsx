import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Map } from 'lucide-react'
import type { Topic, Subject } from '../../db/schema'
import { decayedMastery } from '../../lib/knowledgeGraph'

interface Props {
  topics: Topic[]
  subjects: Subject[]
}

interface DepthLevel {
  key: string
  label: string
  min: number
  max: number
  opacity: string
}

export function LandscapeCard({ topics, subjects }: Props) {
  const { t } = useTranslation()
  const subjectMap = new Map(subjects.map(s => [s.id, s]))

  const LEVEL_KEYS = ['unexplored', 'gettingStarted', 'building', 'deepening', 'strong'] as const

  const levels: DepthLevel[] = [
    { key: 'unexplored', label: t('dashboard.depthLevels.unexplored'), min: 0, max: 0, opacity: 'opacity-20' },
    { key: 'gettingStarted', label: t('dashboard.depthLevels.gettingStarted'), min: 0.01, max: 0.3, opacity: 'opacity-40' },
    { key: 'building', label: t('dashboard.depthLevels.building'), min: 0.31, max: 0.6, opacity: 'opacity-60' },
    { key: 'deepening', label: t('dashboard.depthLevels.deepening'), min: 0.61, max: 0.8, opacity: 'opacity-80' },
    { key: 'strong', label: t('dashboard.depthLevels.strong'), min: 0.81, max: 1, opacity: 'opacity-100' },
  ]

  const grouped = useMemo(() => {
    const groups = new Map<string, Array<Topic & { dm: number }>>()
    for (const key of LEVEL_KEYS) {
      groups.set(key, [])
    }
    for (const topic of topics) {
      const dm = decayedMastery(topic)
      const topicWithDm = { ...topic, dm }
      if (dm === 0) {
        groups.get('unexplored')!.push(topicWithDm)
      } else if (dm <= 0.3) {
        groups.get('gettingStarted')!.push(topicWithDm)
      } else if (dm <= 0.6) {
        groups.get('building')!.push(topicWithDm)
      } else if (dm <= 0.8) {
        groups.get('deepening')!.push(topicWithDm)
      } else {
        groups.get('strong')!.push(topicWithDm)
      }
    }
    return groups
  }, [topics])

  if (topics.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="font-semibold text-[var(--text-heading)] mb-2">{t('dashboard.topicDepth')}</h3>
        <p className="text-sm text-[var(--text-muted)]">{t('dashboard.landscapeEmpty')}</p>
      </div>
    )
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Map className="w-5 h-5 text-[var(--accent-text)]" />
        <h3 className="font-semibold text-[var(--text-heading)]">{t('dashboard.topicDepth')}</h3>
      </div>

      <div className="space-y-3">
        {levels.map(level => {
          const items = grouped.get(level.key) ?? []
          if (items.length === 0) return null

          return (
            <div key={level.key}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-3 h-3 rounded-sm bg-[var(--accent-text)] ${level.opacity}`} />
                <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                  {level.label} ({items.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map(topic => {
                  const subject = subjectMap.get(topic.subjectId)
                  return (
                    <Link
                      key={topic.id}
                      to={`/chat?topic=${encodeURIComponent(topic.name)}`}
                      className={`text-xs px-2 py-1 rounded-md bg-[var(--accent-text)] text-white hover:scale-105 transition-transform ${level.opacity}`}
                      title={`${topic.name}${subject ? ` · ${subject.name}` : ''} — ${Math.round(topic.dm * 100)}%`}
                    >
                      {topic.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
