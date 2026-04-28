import { useTranslation } from 'react-i18next'
import type { Topic, Subject } from '../../db/schema'
import type { TopicStatus } from '../../db/schema'

interface Props {
  topics: Topic[]
  subjects: Subject[]
}

const statusConfig: Record<TopicStatus, { color: string; bg: string }> = {
  'active': { color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]' },
  'exploring': { color: 'text-[var(--color-warning)]', bg: 'bg-[var(--color-warning)]' },
  'blocked': { color: 'text-[var(--color-error)]', bg: 'bg-[var(--color-error)]' },
  'resolved': { color: 'text-gray-500', bg: 'bg-gray-400' },
}

export function ResearchThreadsCard({ topics, subjects }: Props) {
  const { t } = useTranslation()
  const subjectMap = new Map(subjects.map(s => [s.id, s]))

  const grouped = {
    active: topics.filter(tp => tp.status === 'active'),
    exploring: topics.filter(tp => tp.status === 'exploring'),
    blocked: topics.filter(tp => tp.status === 'blocked'),
    resolved: topics.filter(tp => tp.status === 'resolved'),
    unset: topics.filter(tp => !tp.status),
  }

  // Combine unset with exploring for display
  const displayGroups: { key: string; label: string; items: Topic[] }[] = [
    { key: 'active', label: t('research.threadStatus.active'), items: grouped.active },
    { key: 'exploring', label: t('research.threadStatus.exploring'), items: [...grouped.exploring, ...grouped.unset] },
    { key: 'blocked', label: t('research.threadStatus.blocked'), items: grouped.blocked },
    { key: 'resolved', label: t('research.threadStatus.resolved'), items: grouped.resolved },
  ].filter(g => g.items.length > 0)

  if (topics.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="font-semibold text-[var(--text-heading)] mb-2">{t('research.threads')}</h3>
        <p className="text-sm text-[var(--text-muted)]">{t('dashboard.weakTopicsEmpty')}</p>
      </div>
    )
  }

  return (
    <div className="glass-card p-4">
      <h3 className="font-semibold text-[var(--text-heading)] mb-3">{t('research.threads')}</h3>
      <div className="space-y-3">
        {displayGroups.map(group => (
          <div key={group.key}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-2 h-2 rounded-full ${(statusConfig as Record<string, { color: string; bg: string }>)[group.key]?.bg ?? 'bg-gray-400'}`} />
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{group.label}</span>
              <span className="text-xs text-[var(--text-faint)]">({group.items.length})</span>
            </div>
            <div className="space-y-1 ml-4">
              {group.items.slice(0, 4).map(topic => {
                const subject = subjectMap.get(topic.subjectId)
                const pct = Math.round(topic.mastery * 100)
                return (
                  <button
                    key={topic.id}
                    onClick={() => window.dispatchEvent(new CustomEvent('open-chat-panel', {
                      detail: {
                        prefill: `Help me study: ${topic.name}`,
                        context: {
                          topicName: topic.name,
                          ...(subject ? { subjectName: subject.name } : {}),
                        },
                      },
                    }))}
                    className="flex items-center justify-between text-sm hover:bg-[var(--bg-input)] rounded px-2 py-1 transition-colors w-full text-left"
                  >
                    <span className="text-[var(--text-body)] truncate">
                      {topic.name}
                      {subject && <span className="text-[var(--text-faint)]"> &middot; {subject.name}</span>}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] ml-2">{pct}%</span>
                  </button>
                )
              })}
              {group.items.length > 4 && (
                <span className="text-xs text-[var(--text-faint)] ml-2">+{group.items.length - 4} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
