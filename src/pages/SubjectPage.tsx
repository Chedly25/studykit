/**
 * Subject page — shows all topics for a subject as cards with mastery bars.
 * Expandable topic detail panels. Search filter.
 */
import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Search, ChevronDown, ChevronRight, Lock, MessageCircle, BookOpen, FileText } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { isTopicLocked } from '../lib/knowledgeGraph'
import { TopicDetailPanel } from '../components/dashboard/TopicDetailPanel'
import { useBackgroundJobs } from '../components/BackgroundJobsProvider'

function masteryBarColor(mastery: number): string {
  if (mastery >= 0.7) return 'bg-[var(--color-success)]'
  if (mastery >= 0.3) return 'bg-[var(--color-warning)]'
  if (mastery > 0) return 'bg-[var(--color-error)]'
  return 'bg-[var(--text-faint)]'
}

function masteryTextColor(mastery: number): string {
  if (mastery >= 0.7) return 'text-[var(--color-success)]'
  if (mastery >= 0.3) return 'text-[var(--color-warning)]'
  return 'text-[var(--color-error)]'
}

export default function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, getChaptersForSubject, getTopicsForChapter } = useKnowledgeGraph(profileId)

  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null)
  const { enqueue } = useBackgroundJobs()

  // Track which topics have fiches
  const ficheTopicIds = useLiveQuery(
    () => profileId
      ? db.revisionFiches.where('examProfileId').equals(profileId).toArray().then(fs => new Set(fs.map(f => f.topicId)))
      : new Set<string>(),
    [profileId],
  ) ?? new Set<string>()

  const subject = subjects.find(s => s.id === subjectId)
  const subjectChapters = subjectId ? getChaptersForSubject(subjectId) : []
  const allSubjectTopics = topics.filter(t => t.subjectId === subjectId)
  const topicMasteryMap = useMemo(() => new Map(topics.map(t => [t.id, t.mastery])), [topics])

  const avgMastery = allSubjectTopics.length > 0
    ? allSubjectTopics.reduce((s, t) => s + t.mastery, 0) / allSubjectTopics.length
    : 0

  const filteredTopics = useMemo(() => {
    if (!searchQuery) return null // null = use chapter grouping
    return allSubjectTopics.filter(t =>
      (t.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [allSubjectTopics, searchQuery])

  if (!subject) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-sm text-[var(--text-muted)] mb-4">Subject not found.</p>
        <Link to="/dashboard" className="btn-primary px-4 py-2 text-sm">Back to Dashboard</Link>
      </div>
    )
  }

  const dispatchChat = (topicName: string, topicId: string) => {
    window.dispatchEvent(new CustomEvent('open-chat-panel', {
      detail: { subjectId: subject.id, subjectName: subject.name, prefill: `Help me understand: ${topicName}`, context: { topicId, topicName } }
    }))
  }

  const renderTopicCard = (topic: typeof allSubjectTopics[0]) => {
    const lockInfo = isTopicLocked(topic, topicMasteryMap)
    const isExpanded = expandedTopicId === topic.id
    const pct = Math.round(topic.mastery * 100)
    const name = topic.name || `Topic ${topic.id.slice(0, 6)}`

    return (
      <div key={topic.id}>
        <div
          onClick={() => !lockInfo.locked && setExpandedTopicId(prev => prev === topic.id ? null : topic.id)}
          className={`px-4 py-3 border-b border-[var(--border-card)]/30 transition-colors ${
            lockInfo.locked ? 'opacity-40' : 'hover:bg-[var(--bg-input)]/30 cursor-pointer'
          }`}
        >
          {/* Topic name + expand chevron */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {lockInfo.locked && <Lock className="w-3.5 h-3.5 text-[var(--text-faint)] shrink-0" />}
              <span className="text-sm font-medium text-[var(--text-heading)] truncate">
                {name}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-semibold tabular-nums ${masteryTextColor(topic.mastery)}`}>
                {pct}%
              </span>
              {!lockInfo.locked && (
                isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              )}
            </div>
          </div>

          {/* Mastery bar */}
          <div className="w-full h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${masteryBarColor(topic.mastery)}`}
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>

          {/* Action links */}
          {!lockInfo.locked && (
            <div className="flex gap-3 mt-2">
              <Link
                to={`/session?topic=${topic.id}`}
                onClick={e => e.stopPropagation()}
                className="text-xs text-[var(--accent-text)] hover:underline flex items-center gap-1"
              >
                <BookOpen className="w-3 h-3" /> Study
              </Link>
              <button
                onClick={e => { e.stopPropagation(); dispatchChat(name, topic.id) }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] flex items-center gap-1 transition-colors"
              >
                <MessageCircle className="w-3 h-3" /> Ask AI
              </button>
              {ficheTopicIds.has(topic.id) && (
                <Link
                  to={`/fiche/${topic.id}`}
                  onClick={e => e.stopPropagation()}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] flex items-center gap-1 transition-colors"
                >
                  <FileText className="w-3 h-3" /> Fiche
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Expanded detail panel */}
        {isExpanded && profileId && (
          <TopicDetailPanel
            topicId={topic.id}
            topicName={name}
            subjectName={subject.name}
            mastery={topic.mastery}
            examProfileId={profileId}
            questionsAttempted={topic.questionsAttempted}
            questionsCorrect={topic.questionsCorrect}
          />
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 animate-fade-in">
      {/* Back */}
      <Link to="/dashboard" className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Study
      </Link>

      {/* Subject header */}
      <div className="glass-card p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-2.5 h-8 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
          <div>
            <h1 className="text-xl font-bold text-[var(--text-heading)]">{subject.name}</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {allSubjectTopics.length} topic{allSubjectTopics.length !== 1 ? 's' : ''} · {Math.round(avgMastery * 100)}% mastery
            </p>
          </div>
        </div>
        {/* Overall mastery bar */}
        <div className="w-full h-2 rounded-full bg-[var(--bg-input)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${masteryBarColor(avgMastery)}`}
            style={{ width: `${Math.max(Math.round(avgMastery * 100), 2)}%` }}
          />
        </div>
        {/* Batch generate fiches */}
        {profileId && allSubjectTopics.length > 0 && (
          <button
            onClick={async () => {
              for (const t of allSubjectTopics) {
                await enqueue('fiche-generation', profileId, {
                  topicId: t.id,
                  topicName: t.name || `Topic ${t.id.slice(0, 6)}`,
                  subjectId: subject.id,
                  subjectName: subject.name,
                  examName: activeProfile?.name ?? 'Exam',
                }, 1)
              }
            }}
            className="btn-secondary text-xs px-3 py-1.5 mt-3 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> Generate all fiches
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search topics..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="input-field w-full pl-9"
        />
      </div>

      {/* Topic list */}
      {allSubjectTopics.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--text-muted)]">No topics in this subject yet.</p>
        </div>
      ) : filteredTopics !== null ? (
        /* Search results — flat list, no chapters */
        filteredTopics.length > 0 ? (
          <div className="glass-card overflow-hidden">
            {filteredTopics.map(renderTopicCard)}
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No topics match your search.</p>
          </div>
        )
      ) : (
        /* Default — grouped by chapter */
        <div className="space-y-4">
          {subjectChapters.map(ch => {
            const chTopics = getTopicsForChapter(ch.id)
            if (chTopics.length === 0) return null
            const chMastery = chTopics.reduce((s, t) => s + t.mastery, 0) / chTopics.length
            return (
              <div key={ch.id}>
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                    {ch.name}
                  </span>
                  <span className={`text-xs font-semibold ${masteryTextColor(chMastery)}`}>
                    {Math.round(chMastery * 100)}%
                  </span>
                </div>
                <div className="glass-card overflow-hidden">
                  {chTopics.map(renderTopicCard)}
                </div>
              </div>
            )
          })}
          {/* Orphan topics (no chapter) */}
          {(() => {
            const orphans = allSubjectTopics.filter(t => !t.chapterId)
            if (orphans.length === 0) return null
            return (
              <div>
                {subjectChapters.length > 0 && (
                  <div className="flex items-center px-1 mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">General</span>
                  </div>
                )}
                <div className="glass-card overflow-hidden">
                  {orphans.map(renderTopicCard)}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
