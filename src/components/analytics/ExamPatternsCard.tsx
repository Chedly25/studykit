/**
 * Exam pattern analysis card — shows recurring question patterns across past exams.
 * Only renders when ≥2 exam sources exist.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { TrendingUp, Star } from 'lucide-react'
import { db } from '../../db'
import { analyzeExamPatterns, type ExamPatternAnalysis } from '../../lib/examPatternAnalyzer'

interface Props {
  examProfileId: string
}

export function ExamPatternsCard({ examProfileId }: Props) {
  const examSourceCount = useLiveQuery(
    () => db.examSources.where('examProfileId').equals(examProfileId).count(),
    [examProfileId],
  ) ?? 0

  const analysis = useLiveQuery(
    async (): Promise<ExamPatternAnalysis | null> => {
      if (examSourceCount < 2) return null
      return analyzeExamPatterns(examProfileId)
    },
    [examProfileId, examSourceCount],
  )

  if (!analysis || analysis.patterns.length === 0) return null

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-[var(--color-warning)]" />
        <h3 className="text-sm font-bold text-[var(--text-heading)]">Exam Patterns</h3>
        <span className="text-xs text-[var(--text-muted)]">from {analysis.totalExams} past exams</span>
      </div>

      {/* Predictions */}
      {analysis.predictions.length > 0 && (
        <div className="mb-4 space-y-1">
          {analysis.predictions.map((p, i) => (
            <p key={i} className="text-xs text-[var(--text-body)] flex items-start gap-1.5">
              <span className="text-[var(--color-warning)] mt-0.5 shrink-0">*</span>
              {p}
            </p>
          ))}
        </div>
      )}

      {/* Pattern table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--text-faint)] border-b border-[var(--border-card)]">
              <th className="text-left py-1.5 font-medium">Topic</th>
              <th className="text-center py-1.5 font-medium">Frequency</th>
              <th className="text-center py-1.5 font-medium">Avg Difficulty</th>
              <th className="text-center py-1.5 font-medium">Avg Qs</th>
            </tr>
          </thead>
          <tbody>
            {analysis.patterns.slice(0, 10).map(p => (
              <tr key={p.topicId} className="border-b border-[var(--border-card)]/50">
                <td className="py-1.5 text-[var(--text-body)]">
                  <span className={p.frequency === 1 ? 'font-semibold text-[var(--accent-text)]' : ''}>
                    {p.topicName}
                  </span>
                </td>
                <td className="text-center py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    p.frequency === 1
                      ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                      : p.frequency >= 0.75
                        ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                        : 'text-[var(--text-muted)]'
                  }`}>
                    {Math.round(p.frequency * 100)}%
                  </span>
                </td>
                <td className="text-center py-1.5">
                  <DifficultyDots level={p.avgDifficulty} />
                </td>
                <td className="text-center py-1.5 text-[var(--text-muted)]">
                  {p.avgExerciseCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DifficultyDots({ level }: { level: number }) {
  const rounded = Math.round(level)
  return (
    <div className="flex gap-0.5 justify-center">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-2.5 h-2.5 ${i <= rounded ? 'fill-[var(--color-warning)] text-[var(--color-warning)]' : 'text-[var(--border-card)]'}`} />
      ))}
    </div>
  )
}
