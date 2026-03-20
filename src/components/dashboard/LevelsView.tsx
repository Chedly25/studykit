import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, BookOpen, ArrowRight, Lock } from 'lucide-react'
import type { Subject, Topic, Chapter } from '../../db/schema'
import { isTopicLocked } from '../../lib/knowledgeGraph'

interface ExerciseStats {
  total: number
  attempted: number
  completed: number
  avgScore: number
}

interface LevelsViewProps {
  subjects: Subject[]
  chapters: Chapter[]
  topics: Topic[]
  exerciseStatsByTopic: Map<string, ExerciseStats>
  getChaptersForSubject: (subjectId: string) => Chapter[]
  getTopicsForChapter: (chapterId: string) => Topic[]
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

export function LevelsView({ subjects, chapters: _chapters, topics, exerciseStatsByTopic, getChaptersForSubject, getTopicsForChapter }: LevelsViewProps) {
  // Build mastery map for prerequisite checking
  const topicMasteryMap = useMemo(() => {
    return new Map(topics.map(t => [t.id, t.mastery]))
  }, [topics])
  const topicNameMap = useMemo(() => new Map(topics.map(t => [t.id, t.name])), [topics])
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set())
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())

  const toggleSubject = (id: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleChapter = (id: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
        const isExpanded = expandedSubjects.has(subject.id)
        const subjectChapters = getChaptersForSubject(subject.id)
        const subjectTopics = topics.filter(t => t.subjectId === subject.id)
        const avgMastery = subjectTopics.length > 0
          ? subjectTopics.reduce((s, t) => s + t.mastery, 0) / subjectTopics.length
          : 0
        const masteryPct = Math.round(avgMastery * 100)

        return (
          <div key={subject.id} className="glass-card overflow-hidden">
            {/* Subject header */}
            <button
              onClick={() => toggleSubject(subject.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-[var(--bg-input)]/50 transition-colors"
            >
              <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
              {isExpanded ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />}
              <div className="flex-1 text-left">
                <h3 className="text-sm font-semibold text-[var(--text-heading)]">{subject.name}</h3>
                <span className="text-xs text-[var(--text-muted)]">
                  {subjectChapters.length} chapter{subjectChapters.length !== 1 ? 's' : ''} · {subjectTopics.length} topics
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-20 h-2 rounded-full bg-[var(--bg-input)] overflow-hidden">
                  <div className={`h-full rounded-full ${masteryColor(avgMastery)} transition-all`} style={{ width: `${masteryPct}%` }} />
                </div>
                <span className={`text-xs font-semibold w-8 text-right ${masteryTextColor(avgMastery)}`}>{masteryPct}%</span>
              </div>
            </button>

            {/* Chapters */}
            {isExpanded && (
              <div className="border-t border-[var(--border-card)]">
                {subjectChapters.map(chapter => {
                  const chapterExpanded = expandedChapters.has(chapter.id)
                  const chapterTopics = getTopicsForChapter(chapter.id)
                  const chapterMastery = chapterTopics.length > 0
                    ? chapterTopics.reduce((s, t) => s + t.mastery, 0) / chapterTopics.length
                    : 0
                  const chapterPct = Math.round(chapterMastery * 100)

                  return (
                    <div key={chapter.id}>
                      <button
                        onClick={() => toggleChapter(chapter.id)}
                        className="w-full flex items-center gap-3 px-6 py-3 hover:bg-[var(--bg-input)]/30 transition-colors border-b border-[var(--border-card)]/50"
                      >
                        {chapterExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                        <span className="flex-1 text-left text-xs font-medium text-[var(--text-heading)]">{chapter.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-16 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                            <div className={`h-full rounded-full ${masteryColor(chapterMastery)} transition-all`} style={{ width: `${chapterPct}%` }} />
                          </div>
                          <span className={`text-[10px] font-semibold w-7 text-right ${masteryTextColor(chapterMastery)}`}>{chapterPct}%</span>
                        </div>
                      </button>

                      {/* Topics */}
                      {chapterExpanded && chapterTopics.map(topic => {
                        const topicPct = Math.round(topic.mastery * 100)
                        const stats = exerciseStatsByTopic.get(topic.id)
                        const lockInfo = isTopicLocked(topic, topicMasteryMap)
                        const prereqNames = lockInfo.blockingPrereqs.map(id => topicNameMap.get(id) ?? 'Unknown')
                        // If locked, link to first blocking prerequisite instead
                        const firstBlockingPrereq = lockInfo.locked
                          ? topics.find(t => t.id === lockInfo.blockingPrereqs[0])
                          : null
                        const linkTarget = lockInfo.locked && firstBlockingPrereq
                          ? `/session?topic=${encodeURIComponent(firstBlockingPrereq.name)}`
                          : `/session?topic=${encodeURIComponent(topic.name)}`

                        return (
                          <div key={topic.id} className={`flex items-center gap-3 px-10 py-2.5 border-b border-[var(--border-card)]/30 hover:bg-[var(--bg-input)]/20 ${lockInfo.locked ? 'opacity-60' : ''}`}>
                            {lockInfo.locked ? (
                              <Lock className="w-3 h-3 text-[var(--text-faint)] flex-shrink-0" />
                            ) : (
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${masteryColor(topic.mastery)}`} />
                            )}
                            <span className="flex-1 text-xs text-[var(--text-body)]" title={lockInfo.locked ? `Master ${prereqNames.join(', ')} first` : undefined}>
                              {topic.name}
                            </span>
                            {stats && stats.total > 0 && (
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {stats.completed}/{stats.total} ex.
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <div className={`w-12 h-1 rounded-full bg-[var(--bg-input)] overflow-hidden ${lockInfo.locked ? 'opacity-50' : ''}`}>
                                <div className={`h-full rounded-full ${masteryColor(topic.mastery)}`} style={{ width: `${topicPct}%` }} />
                              </div>
                              <span className="text-[10px] text-[var(--text-muted)] w-6 text-right">{topicPct}%</span>
                            </div>
                            <Link
                              to={linkTarget}
                              className="p-1 rounded hover:bg-[var(--accent-bg)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                              title={lockInfo.locked ? `Go to prerequisite: ${prereqNames[0]}` : undefined}
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
