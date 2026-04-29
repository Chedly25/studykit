/**
 * Gap Analysis Card — shows which programme topics are missing from the
 * user's uploaded courses. Click to run analysis, then explore the tree.
 */
import { useState, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Target, CheckCircle, AlertTriangle, XCircle, GraduationCap, ChevronDown, ChevronRight } from 'lucide-react'
import { computeCourseGaps, type GapAnalysisResult, type GapStatus } from '../../lib/gapAnalysis'

interface Props {
  examProfileId: string
}

const STATUS_ICON = {
  covered: CheckCircle,
  weak: AlertTriangle,
  missing: XCircle,
}

const STATUS_COLOR = {
  covered: 'text-[var(--color-success)]',
  weak: 'text-[var(--color-warning)]',
  missing: 'text-[var(--color-error)]',
}

export default function GapAnalysisCard({ examProfileId }: Props) {
  const { getToken } = useAuth()
  const [result, setResult] = useState<GapAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set())
  const [showOnly, setShowOnly] = useState<GapStatus | 'all'>('all')

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setResult(null)
    setProgress({ done: 0, total: 0 })
    try {
      const token = await getToken()
      const gaps = await computeCourseGaps(
        examProfileId,
        token ?? undefined,
        (done, total) => setProgress({ done, total }),
      )
      setResult(gaps)
      // Auto-expand subjects with missing topics
      const missing = new Set(gaps.subjects.filter(s => s.topicsMissing > 0).map(s => s.subjectName))
      setExpandedSubjects(missing)
    } finally {
      setLoading(false)
    }
  }, [examProfileId, getToken])

  const toggleSubject = (name: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-[var(--accent)]" />
          <h3 className="text-base font-semibold text-[var(--text-heading)]">
            Qu'est-ce qui manque dans mon cours ?
          </h3>
        </div>
        {!loading && !result && (
          <button
            onClick={runAnalysis}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            Analyser
          </button>
        )}
        {result && !loading && (
          <button
            onClick={runAnalysis}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]"
          >
            Relancer
          </button>
        )}
      </div>

      {!loading && !result && (
        <p className="text-sm text-[var(--text-muted)]">
          Compare tes cours uploadés au programme officiel CPGE MP et identifie les sujets manquants.
        </p>
      )}

      {loading && (
        <div className="py-8 text-center">
          <GraduationCap className="w-8 h-8 text-[var(--accent-text)] animate-gentle-pulse mx-auto mb-3" />
          <p className="text-sm text-[var(--text-body)] mb-1">
            Analyse en cours...
          </p>
          {progress.total > 0 && (
            <>
              <p className="text-xs text-[var(--text-muted)]">
                {progress.done} / {progress.total} sujets analysés
              </p>
              <div className="h-1 bg-[var(--bg-input)] rounded-full mt-3 max-w-xs mx-auto overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Overall coverage */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[var(--accent)]/10 to-[var(--accent)]/5 border border-[var(--accent)]/20">
            <div className="flex items-end justify-between mb-2">
              <div>
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                  Couverture du programme
                </div>
                <div className="text-3xl font-bold text-[var(--text-heading)] mt-1">
                  {result.overallCoveragePercent}%
                </div>
              </div>
              <div className="text-right text-xs text-[var(--text-muted)]">
                <div>{result.coveredTopics} couverts</div>
                <div className="text-[var(--color-error)]">{result.missingTopics} manquants</div>
              </div>
            </div>
            <div className="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--color-success)] via-[var(--color-warning)] to-[var(--color-error)]"
                style={{ width: `${result.overallCoveragePercent}%` }}
              />
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[var(--text-muted)] mr-1">Filtrer :</span>
            {(['all', 'missing', 'weak', 'covered'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setShowOnly(filter)}
                className={`px-2 py-0.5 rounded ${
                  showOnly === filter
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
                }`}
              >
                {filter === 'all' ? 'Tous' : filter === 'missing' ? 'Manquants' : filter === 'weak' ? 'Faibles' : 'Couverts'}
              </button>
            ))}
          </div>

          {/* Subjects tree */}
          <div className="space-y-2">
            {result.subjects.map(subject => {
              const isExpanded = expandedSubjects.has(subject.subjectName)
              return (
                <div key={subject.subjectName} className="border border-[var(--border-card)] rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSubject(subject.subjectName)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-input)]/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span className="text-sm font-medium text-[var(--text-heading)]">{subject.subjectName}</span>
                      <span className="text-xs text-[var(--text-muted)]">({subject.weight}%)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--color-success)]">{subject.topicsCovered}</span>
                      <span className="text-[var(--color-warning)]">{subject.topicsWeak}</span>
                      <span className="text-[var(--color-error)]">{subject.topicsMissing}</span>
                      <span className="text-[var(--text-muted)] tabular-nums">{subject.coveragePercent}%</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-[var(--border-card)] bg-[var(--bg-input)]/20 divide-y divide-[var(--border-card)]">
                      {subject.chapters.map(chapter => {
                        const filtered = chapter.topics.filter(t => showOnly === 'all' || t.status === showOnly)
                        if (filtered.length === 0) return null
                        return (
                          <div key={chapter.chapterName} className="px-4 py-2">
                            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                              {chapter.chapterName}
                            </div>
                            <ul className="space-y-1">
                              {filtered.map(topic => {
                                const Icon = STATUS_ICON[topic.status]
                                return (
                                  <li key={topic.topicName} className="flex items-center gap-2 text-xs">
                                    <Icon className={`w-3 h-3 shrink-0 ${STATUS_COLOR[topic.status]}`} />
                                    <span className="text-[var(--text-body)]">{topic.topicName}</span>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
