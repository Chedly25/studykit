import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Search, ChevronDown, ChevronRight, Lock, ArrowRight } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useTopicStats } from '../hooks/useTopicStats'
import { useExerciseBank } from '../hooks/useExerciseBank'
import { isTopicLocked } from '../lib/knowledgeGraph'
import { TopicDetailPanel } from '../components/dashboard/TopicDetailPanel'
import type { Topic } from '../db/schema'

type FilterType = 'has-course' | 'has-exam' | 'not-started' | 'in-progress' | 'mastered'

const FILTER_LABELS: Record<FilterType, string> = {
  'has-course': 'Has course',
  'has-exam': 'Has exams',
  'not-started': 'Not started',
  'in-progress': 'In progress',
  'mastered': 'Mastered',
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

export default function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, getChaptersForSubject, getTopicsForChapter } = useKnowledgeGraph(profileId)
  const topicStats = useTopicStats(profileId)
  const { getExerciseStatsByTopic: getExerciseStatsMap } = useExerciseBank(profileId)
  const exerciseStatsByTopic = useMemo(() => getExerciseStatsMap(), [getExerciseStatsMap])

  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set())
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null)

  const subject = subjects.find(s => s.id === subjectId)
  const subjectChapters = subjectId ? getChaptersForSubject(subjectId) : []
  const allSubjectTopics = topics.filter(t => t.subjectId === subjectId)

  const topicMasteryMap = useMemo(() => new Map(topics.map(t => [t.id, t.mastery])), [topics])
  const topicNameMap = useMemo(() => new Map(topics.map(t => [t.id, t.name])), [topics])

  const avgMastery = allSubjectTopics.length > 0
    ? allSubjectTopics.reduce((s, t) => s + t.mastery, 0) / allSubjectTopics.length
    : 0

  const toggleFilter = (filter: FilterType) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.has(filter) ? next.delete(filter) : next.add(filter)
      return next
    })
  }

  const matchesTopic = (topic: Topic): boolean => {
    if (searchQuery && !topic.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (activeFilters.size === 0) return true
    const stats = topicStats.get(topic.id)
    if (activeFilters.has('has-course') && !(stats?.docs)) return false
    if (activeFilters.has('has-exam') && !(stats?.exercises)) return false
    if (activeFilters.has('not-started') && topic.mastery > 0) return false
    if (activeFilters.has('in-progress') && (topic.mastery === 0 || topic.mastery >= 0.7)) return false
    if (activeFilters.has('mastered') && topic.mastery < 0.7) return false
    return true
  }

  const filteredChapters = subjectChapters.map(ch => ({
    chapter: ch,
    topics: getTopicsForChapter(ch.id).filter(matchesTopic),
  })).filter(({ topics: t }) => t.length > 0)

  // Orphan topics (no chapterId)
  const orphanTopics = allSubjectTopics.filter(t => !t.chapterId && matchesTopic(t))

  if (!subject) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-sm text-[var(--text-muted)] mb-4">Subject not found.</p>
        <Link to="/dashboard" className="btn-primary px-4 py-2 text-sm">Back to Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      {/* Back */}
      <Link to="/dashboard" className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Dashboard
      </Link>

      {/* Subject header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
        <div>
          <h1 className="text-xl font-bold text-[var(--text-heading)]">{subject.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {subjectChapters.length} chapter{subjectChapters.length !== 1 ? 's' : ''} · {allSubjectTopics.length} topic{allSubjectTopics.length !== 1 ? 's' : ''} · {Math.round(avgMastery * 100)}% mastery
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search topics..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-card)] text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map(filter => (
          <button
            key={filter}
            onClick={() => toggleFilter(filter)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeFilters.has(filter)
                ? 'bg-[var(--accent-text)] text-white border-transparent'
                : 'bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-card)] hover:border-[var(--accent-text)]'
            }`}
          >
            {FILTER_LABELS[filter]}
          </button>
        ))}
      </div>

      {/* Chapters + Topics */}
      <div className="space-y-3">
        {filteredChapters.map(({ chapter, topics: chapterTopics }) => {
          const chapterMastery = chapterTopics.length > 0
            ? chapterTopics.reduce((s, t) => s + t.mastery, 0) / chapterTopics.length
            : 0
          const chapterPct = Math.round(chapterMastery * 100)

          return (
            <div key={chapter.id} className="glass-card overflow-hidden">
              {/* Chapter header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-card)]/50">
                <span className="flex-1 text-xs font-semibold text-[var(--text-heading)]">{chapter.name}</span>
                <span className="text-xs text-[var(--text-muted)]">{chapterTopics.length} topic{chapterTopics.length !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-16 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                    <div className={`h-full rounded-full ${masteryColor(chapterMastery)} transition-all`} style={{ width: `${chapterPct}%` }} />
                  </div>
                  <span className={`text-[10px] font-semibold w-7 text-right ${masteryTextColor(chapterMastery)}`}>{chapterPct}%</span>
                </div>
              </div>

              {/* Topic rows */}
              {chapterTopics.map(topic => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  stats={topicStats.get(topic.id)}
                  exerciseStats={exerciseStatsByTopic.get(topic.id)}
                  topicMasteryMap={topicMasteryMap}
                  topicNameMap={topicNameMap}
                  isExpanded={expandedTopicId === topic.id}
                  onToggle={() => setExpandedTopicId(prev => prev === topic.id ? null : topic.id)}
                  examProfileId={profileId}
                  subjectName={subject.name}
                />
              ))}
            </div>
          )
        })}

        {/* Orphan topics (no chapter) */}
        {orphanTopics.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-card)]/50">
              <span className="flex-1 text-xs font-semibold text-[var(--text-heading)]">General</span>
              <span className="text-xs text-[var(--text-muted)]">{orphanTopics.length} topic{orphanTopics.length !== 1 ? 's' : ''}</span>
            </div>
            {orphanTopics.map(topic => (
              <TopicRow
                key={topic.id}
                topic={topic}
                stats={topicStats.get(topic.id)}
                exerciseStats={exerciseStatsByTopic.get(topic.id)}
                topicMasteryMap={topicMasteryMap}
                topicNameMap={topicNameMap}
                isExpanded={expandedTopicId === topic.id}
                onToggle={() => setExpandedTopicId(prev => prev === topic.id ? null : topic.id)}
                examProfileId={profileId}
                subjectName={subject.name}
              />
            ))}
          </div>
        )}
      </div>

      {/* Empty filter state */}
      {filteredChapters.length === 0 && orphanTopics.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No topics match your search.</p>
          {activeFilters.size > 0 && (
            <button onClick={() => setActiveFilters(new Set())} className="text-xs text-[var(--accent-text)] hover:underline mt-2">
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Topic Row ──────

interface TopicRowProps {
  topic: Topic
  stats?: { docs: number; exercises: number; flashcards: number; cards: number; dueFlashcards: number }
  exerciseStats?: { total: number; completed: number }
  topicMasteryMap: Map<string, number>
  topicNameMap: Map<string, string>
  isExpanded: boolean
  onToggle: () => void
  examProfileId?: string
  subjectName: string
}

function TopicRow({ topic, stats, exerciseStats, topicMasteryMap, topicNameMap, isExpanded, onToggle, examProfileId, subjectName }: TopicRowProps) {
  const topicPct = Math.round(topic.mastery * 100)
  const lockInfo = isTopicLocked(topic, topicMasteryMap)
  const prereqNames = lockInfo.blockingPrereqs.map(id => topicNameMap.get(id) ?? 'Unknown')

  return (
    <div data-topic-id={topic.id}>
      <div
        onClick={() => !lockInfo.locked && onToggle()}
        className={`flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-card)]/30 hover:bg-[var(--bg-input)]/20 ${lockInfo.locked ? 'opacity-60' : 'cursor-pointer'}`}
      >
        {lockInfo.locked ? (
          <Lock className="w-3 h-3 text-[var(--text-faint)] flex-shrink-0" />
        ) : (
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${masteryColor(topic.mastery)}`} />
        )}

        <span className="flex-1 text-xs text-[var(--text-body)] min-w-0 truncate" title={lockInfo.locked ? `Master ${prereqNames.join(', ')} first` : undefined}>
          {topic.name}
        </span>

        {/* Stat chips */}
        <div className="flex items-center gap-1 shrink-0">
          {(stats?.docs ?? 0) > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">
              {stats!.docs} doc{stats!.docs !== 1 ? 's' : ''}
            </span>
          )}
          {(stats?.exercises ?? 0) > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 font-medium">
              {exerciseStats ? `${exerciseStats.completed}/${exerciseStats.total}` : stats!.exercises} ex.
            </span>
          )}
          {(stats?.cards ?? 0) > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 font-medium">
              {stats!.cards} card{stats!.cards !== 1 ? 's' : ''}
            </span>
          )}
          {(stats?.dueFlashcards ?? 0) > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">
              {stats!.dueFlashcards} due
            </span>
          )}
        </div>

        {/* Mastery bar */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`w-12 h-1 rounded-full bg-[var(--bg-input)] overflow-hidden ${lockInfo.locked ? 'opacity-50' : ''}`}>
            <div className={`h-full rounded-full ${masteryColor(topic.mastery)}`} style={{ width: `${topicPct}%` }} />
          </div>
          <span className="text-[10px] text-[var(--text-muted)] w-6 text-right">{topicPct}%</span>
        </div>

        {lockInfo.locked ? (
          <Link
            to={`/session?topic=${encodeURIComponent(prereqNames[0] ?? '')}`}
            onClick={e => e.stopPropagation()}
            className="p-1 rounded hover:bg-[var(--accent-bg)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
            title={`Go to prerequisite: ${prereqNames[0]}`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          isExpanded
            ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        )}
      </div>

      {isExpanded && examProfileId && (
        <TopicDetailPanel
          topicId={topic.id}
          topicName={topic.name}
          subjectName={subjectName}
          mastery={topic.mastery}
          examProfileId={examProfileId}
          questionsAttempted={topic.questionsAttempted}
          questionsCorrect={topic.questionsCorrect}
        />
      )}
    </div>
  )
}
