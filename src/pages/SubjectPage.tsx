import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Search, ChevronDown, ChevronRight, Lock, ArrowRight, ArrowUpDown } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useTopicStats, type TopicContentStats } from '../hooks/useTopicStats'
import { useExerciseBank } from '../hooks/useExerciseBank'
import { isTopicLocked } from '../lib/knowledgeGraph'
import { TopicDetailPanel } from '../components/dashboard/TopicDetailPanel'
import type { Topic } from '../db/schema'

type FilterType = 'has-course' | 'has-exam' | 'not-started' | 'in-progress' | 'mastered'
type SortType = 'default' | 'mastery-asc' | 'mastery-desc' | 'docs' | 'exercises'

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
  const [sortBy, setSortBy] = useState<SortType>('default')

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

  const handleSort = (key: string) => {
    setSortBy(prev => {
      if (prev === key) return (key + '-desc') as SortType
      if (prev === key + '-desc') return 'default'
      return key as SortType
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

  // Build table rows: either grouped by chapter (default sort) or flat (sorted)
  type TableRow = { type: 'chapter'; name: string; mastery: number; topicCount: number } | { type: 'topic'; topic: Topic }

  const tableRows = useMemo((): TableRow[] => {
    const filtered = allSubjectTopics.filter(matchesTopic)

    if (sortBy !== 'default') {
      // Flat sorted view — no chapter headers
      const sorted = [...filtered].sort((a, b) => {
        const sa = topicStats.get(a.id)
        const sb = topicStats.get(b.id)
        switch (sortBy) {
          case 'mastery-asc': return a.mastery - b.mastery
          case 'mastery-desc': return b.mastery - a.mastery
          case 'docs': return (sb?.docs ?? 0) - (sa?.docs ?? 0)
          case 'exercises': return (sb?.exercises ?? 0) - (sa?.exercises ?? 0)
          default: return 0
        }
      })
      return sorted.map(t => ({ type: 'topic' as const, topic: t }))
    }

    // Default: grouped by chapter
    const rows: TableRow[] = []
    for (const ch of subjectChapters) {
      const chTopics = getTopicsForChapter(ch.id).filter(matchesTopic)
      if (chTopics.length === 0) continue
      const chMastery = chTopics.reduce((s, t) => s + t.mastery, 0) / chTopics.length
      rows.push({ type: 'chapter', name: ch.name, mastery: chMastery, topicCount: chTopics.length })
      for (const t of chTopics) rows.push({ type: 'topic', topic: t })
    }
    // Orphan topics
    const orphans = allSubjectTopics.filter(t => !t.chapterId && matchesTopic(t))
    if (orphans.length > 0) {
      rows.push({ type: 'chapter', name: 'General', mastery: orphans.reduce((s, t) => s + t.mastery, 0) / orphans.length, topicCount: orphans.length })
      for (const t of orphans) rows.push({ type: 'topic', topic: t })
    }
    return rows
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSubjectTopics, subjectChapters, sortBy, searchQuery, activeFilters, topicStats])

  if (!subject) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-sm text-[var(--text-muted)] mb-4">Subject not found.</p>
        <Link to="/dashboard" className="btn-primary px-4 py-2 text-sm">Back to Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-fade-in">
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

      {/* Table */}
      {tableRows.length > 0 ? (
        <div className="glass-card overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center px-3 py-2 border-b border-[var(--border-card)] bg-[var(--bg-input)]/30">
            <div className="w-5" />
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Topic</span>
            <SortHeader label="Docs" sortKey="docs" currentSort={sortBy} onSort={handleSort} width="w-14" />
            <SortHeader label="Ex." sortKey="exercises" currentSort={sortBy} onSort={handleSort} width="w-14" />
            <span className="w-14 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Cards</span>
            <SortHeader label="Mastery" sortKey="mastery-asc" currentSort={sortBy} onSort={handleSort} width="w-20" align="right" />
            <div className="w-5" />
          </div>

          {/* Rows */}
          {tableRows.map((row, i) => {
            if (row.type === 'chapter') {
              const pct = Math.round(row.mastery * 100)
              return (
                <div key={`ch-${i}`} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-input)]/40 border-b border-[var(--border-card)]/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex-1">
                    {row.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-faint)]">{row.topicCount} topic{row.topicCount !== 1 ? 's' : ''}</span>
                  <div className="w-12 h-1 rounded-full bg-[var(--bg-input)] overflow-hidden">
                    <div className={`h-full rounded-full ${masteryColor(row.mastery)}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-[10px] font-semibold w-7 text-right ${masteryTextColor(row.mastery)}`}>{pct}%</span>
                </div>
              )
            }

            const { topic } = row
            const stats = topicStats.get(topic.id)
            const exStats = exerciseStatsByTopic.get(topic.id)
            const lockInfo = isTopicLocked(topic, topicMasteryMap)
            const isExpanded = expandedTopicId === topic.id
            const pct = Math.round(topic.mastery * 100)

            return (
              <div key={topic.id} data-topic-id={topic.id}>
                <div
                  onClick={() => !lockInfo.locked && setExpandedTopicId(prev => prev === topic.id ? null : topic.id)}
                  className={`flex items-center px-3 py-1.5 border-b border-[var(--border-card)]/20 hover:bg-[var(--bg-input)]/20 ${lockInfo.locked ? 'opacity-50' : 'cursor-pointer'}`}
                >
                  {/* Mastery dot / lock */}
                  <div className="w-5 flex justify-center">
                    {lockInfo.locked
                      ? <Lock className="w-3 h-3 text-[var(--text-faint)]" />
                      : <div className={`w-1.5 h-1.5 rounded-full ${masteryColor(topic.mastery)}`} />
                    }
                  </div>

                  {/* Topic name */}
                  <span className="flex-1 text-xs text-[var(--text-body)] truncate min-w-0 pr-2">
                    {topic.name}
                  </span>

                  {/* Docs */}
                  <div className="w-14 flex justify-center">
                    {(stats?.docs ?? 0) > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">{stats!.docs}</span>
                    )}
                  </div>

                  {/* Exercises */}
                  <div className="w-14 flex justify-center">
                    {(stats?.exercises ?? 0) > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 font-medium">
                        {exStats ? `${exStats.completed}/${exStats.total}` : stats!.exercises}
                      </span>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="w-14 flex justify-center">
                    {(stats?.cards ?? 0) > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 font-medium">{stats!.cards}</span>
                    )}
                  </div>

                  {/* Mastery bar + % */}
                  <div className="w-20 flex items-center gap-1.5 justify-end">
                    <div className={`w-10 h-1 rounded-full bg-[var(--bg-input)] overflow-hidden ${lockInfo.locked ? 'opacity-50' : ''}`}>
                      <div className={`h-full rounded-full ${masteryColor(topic.mastery)}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-[10px] font-semibold w-7 text-right ${masteryTextColor(topic.mastery)}`}>{pct}%</span>
                  </div>

                  {/* Chevron / prereq link */}
                  <div className="w-5 flex justify-center">
                    {lockInfo.locked ? (
                      <Link
                        to={`/session?topic=${encodeURIComponent(topicNameMap.get(lockInfo.blockingPrereqs[0]) ?? '')}`}
                        onClick={e => e.stopPropagation()}
                        className="text-[var(--text-muted)] hover:text-[var(--accent-text)]"
                        title={`Go to prerequisite`}
                      >
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    ) : (
                      isExpanded
                        ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                        : <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                    )}
                  </div>
                </div>

                {isExpanded && profileId && (
                  <TopicDetailPanel
                    topicId={topic.id}
                    topicName={topic.name}
                    subjectName={subject.name}
                    mastery={topic.mastery}
                    examProfileId={profileId}
                    questionsAttempted={topic.questionsAttempted}
                    questionsCorrect={topic.questionsCorrect}
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : (
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

// ─── Sort Header ──────

function SortHeader({ label, sortKey, currentSort, onSort, width, align }: {
  label: string; sortKey: string; currentSort: string; onSort: (key: string) => void
  width: string; align?: 'right'
}) {
  const isActive = currentSort === sortKey || currentSort === sortKey.replace('-asc', '-desc')
  const isDesc = currentSort.endsWith('-desc')
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`${width} flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${align === 'right' ? 'justify-end' : 'justify-center'} ${isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}
    >
      {label}
      {isActive && <ArrowUpDown className="w-2.5 h-2.5" />}
    </button>
  )
}
