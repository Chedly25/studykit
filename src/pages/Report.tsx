import { useEffect, useState } from 'react'
import { useExamProfile } from '../hooks/useExamProfile'
import { computeReportData, type ReportData } from '../lib/reportData'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'

// ─── Sparkline SVG ─────────────────────────────────────────────────

function Sparkline({
  points,
  color,
}: {
  points: Array<{ date: string; mastery: number }>
  color: string
}) {
  if (points.length < 2) return <span className="text-xs text-[var(--text-faint)]">--</span>

  const w = 100
  const h = 30
  const maxM = Math.max(...points.map((p) => p.mastery), 0.01)

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w
    const y = h - (p.mastery / maxM) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Heatmap ───────────────────────────────────────────────────────

function StudyHeatmap({ data }: { data: Array<{ date: string; hours: number }> }) {
  // Arrange into a grid: 7 rows (Mon-Sun) x N cols (weeks)
  // Start from the earliest date, fill a 7xN grid
  if (data.length === 0) return null

  const maxHours = Math.max(...data.map((d) => d.hours), 0.01)

  // Group by week columns
  const weeks: Array<Array<{ date: string; hours: number } | null>> = []
  let currentWeek: Array<{ date: string; hours: number } | null> = []

  // Start from the first date; determine its day of week (0=Mon)
  const firstDow = (new Date(data[0].date + 'T12:00:00').getDay() + 6) % 7 // Mon=0
  // Pad the first week with nulls
  for (let i = 0; i < firstDow; i++) currentWeek.push(null)

  for (const d of data) {
    currentWeek.push(d)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null)
    weeks.push(currentWeek)
  }

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  function heatColor(hours: number): string {
    if (hours === 0) return 'var(--border-card)'
    const intensity = Math.min(hours / maxHours, 1)
    if (intensity < 0.33) return '#86efac' // light green
    if (intensity < 0.66) return '#4ade80' // medium green
    return '#16a34a' // dark green
  }

  return (
    <div className="flex gap-1">
      <div className="flex flex-col gap-1 mr-1">
        {dayLabels.map((d, i) => (
          <div key={i} className="w-3 h-3 text-[8px] text-[var(--text-faint)] flex items-center justify-center leading-none">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((day, di) => (
            <div
              key={di}
              className="w-3 h-3 rounded-[2px]"
              style={{ backgroundColor: day ? heatColor(day.hours) : 'transparent' }}
              title={day ? `${day.date}: ${day.hours.toFixed(1)}h` : ''}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Mastery color helper ──────────────────────────────────────────

function masteryColor(mastery: number): string {
  if (mastery < 30) return '#ef4444'
  if (mastery < 60) return '#f59e0b'
  return '#22c55e'
}

function masteryBadgeClass(mastery: number): string {
  if (mastery < 30) return 'bg-red-500/10 text-red-600'
  if (mastery < 60) return 'bg-amber-500/10 text-amber-600'
  return 'bg-green-500/10 text-green-600'
}

// ─── Report Page ───────────────────────────────────────────────────

export default function Report() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profileId) return
    setLoading(true)
    computeReportData(profileId)
      .then(setData)
      .finally(() => setLoading(false))
  }, [profileId])

  if (!profileId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('report.title', 'Study Report')}</h1>
        <p className="text-[var(--text-muted)]">{t('report.noData', 'Not enough data to generate a report. Complete some study sessions first.')}</p>
        <Link to="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">{t('common.createProfile')}</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('report.title', 'Study Report')}</h1>
        <p className="text-[var(--text-muted)]">{t('report.noData', 'Not enough data to generate a report. Complete some study sessions first.')}</p>
      </div>
    )
  }

  const generatedDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          nav, header, aside, .no-print, .layout-sidebar, footer,
          [class*="layout-sidebar"], [class*="no-print"] { display: none !important; }
          .report-container { max-width: 100% !important; margin: 0 !important; padding: 1cm !important; }
          .glass-card { background: white !important; border: 1px solid #ddd !important; box-shadow: none !important; }
          .report-section { break-inside: avoid; margin-bottom: 1cm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-size: 11pt; }
        }
      `}</style>

      <div className="report-container max-w-4xl mx-auto px-4 py-6 animate-fade-in">
        {/* ─── Header ─── */}
        <div className="report-section flex items-start justify-between mb-8">
          <div>
            <Link to="/analytics" className="text-sm text-[var(--accent-text)] hover:underline flex items-center gap-1 mb-3 no-print">
              <ArrowLeft className="w-3 h-3" /> {t('nav.analytics')}
            </Link>
            <h1 className="text-3xl font-bold text-[var(--text-heading)] mb-1">{data.profile.name}</h1>
            <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
              {data.profile.examDate && (
                <span>
                  {new Date(data.profile.examDate + 'T12:00:00').toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
              <span>{t('report.generatedOn', { date: generatedDate })}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 no-print">
            <span className="text-sm font-semibold text-[var(--text-heading)] opacity-60">StudiesKit</span>
            <button
              onClick={() => window.print()}
              className="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              {t('report.printSave', 'Print / Save as PDF')}
            </button>
          </div>
        </div>

        {/* ─── Executive Summary ─── */}
        <div className="report-section mb-6">
          <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">
            {t('report.executiveSummary', 'Executive Summary')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <StatCard label={t('report.overallReadiness', 'Overall Readiness')} value={`${data.summary.readiness}%`} />
            <StatCard label={t('report.totalStudyHours', 'Total Study Hours')} value={`${data.summary.studyHours}h`} />
            <StatCard label={t('report.currentStreak', 'Current Streak')} value={`${data.summary.streak}d`} />
            <StatCard label={t('report.questionsAnswered', 'Questions Answered')} value={String(data.summary.questionsAnswered)} />
            <StatCard label={t('report.accuracy', 'Accuracy')} value={`${data.summary.accuracy}%`} />
          </div>
        </div>

        {/* ─── Subject Mastery Bars ─── */}
        <div className="report-section glass-card p-5 mb-6">
          <h2 className="text-lg font-bold text-[var(--text-heading)] mb-4">
            {t('report.masteryOverview', 'Mastery Overview')}
          </h2>
          <div className="space-y-3">
            {data.subjects.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--text-body)] font-medium">{s.name}</span>
                  <span className="text-[var(--text-muted)]">{Math.round(s.mastery * 100)}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[var(--border-card)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(s.mastery * 100, 1)}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Mastery Trajectory ─── */}
        {data.masteryTrajectory.size > 0 && (
          <div className="report-section glass-card p-5 mb-6">
            <h2 className="text-lg font-bold text-[var(--text-heading)] mb-4">
              {t('report.masteryTrajectory', 'Mastery Trajectory')}
            </h2>
            <div className="space-y-3">
              {data.subjects
                .filter((s) => data.masteryTrajectory.has(s.id) && (data.masteryTrajectory.get(s.id)?.length ?? 0) >= 2)
                .slice(0, 5)
                .map((s) => {
                  const points = data.masteryTrajectory.get(s.id) ?? []
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <span
                        className="text-sm font-medium w-32 truncate"
                        style={{ color: s.color }}
                      >
                        {s.name}
                      </span>
                      <div className="flex-1">
                        <Sparkline points={points} color={s.color} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* ─── Exam History ─── */}
        <div className="report-section glass-card p-5 mb-6">
          <h2 className="text-lg font-bold text-[var(--text-heading)] mb-4">
            {t('report.examHistory', 'Practice Exam History')}
          </h2>
          {data.examHistory.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              {t('report.noExams', 'No practice exams taken yet')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-card)]">
                    <th className="text-left py-2 text-[var(--text-muted)] font-medium">Date</th>
                    <th className="text-left py-2 text-[var(--text-muted)] font-medium">Score</th>
                    <th className="text-left py-2 text-[var(--text-muted)] font-medium">%</th>
                    <th className="text-left py-2 text-[var(--text-muted)] font-medium">Questions</th>
                    <th className="text-left py-2 text-[var(--text-muted)] font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {data.examHistory.map((e, i) => (
                    <tr key={i} className="border-b border-[var(--border-card)]/50">
                      <td className="py-2 text-[var(--text-body)]">{e.date}</td>
                      <td className="py-2 text-[var(--text-body)]">
                        {e.score}/{e.maxScore}
                      </td>
                      <td className="py-2 text-[var(--text-body)]">{e.percentage}%</td>
                      <td className="py-2 text-[var(--text-body)]">{e.questionCount}</td>
                      <td className="py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            e.passed
                              ? 'bg-green-500/10 text-green-600'
                              : 'bg-red-500/10 text-red-600'
                          }`}
                        >
                          {e.passed ? t('report.passed', 'Passed') : t('report.failed', 'Failed')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── Study Consistency Heatmap ─── */}
        <div className="report-section glass-card p-5 mb-6">
          <h2 className="text-lg font-bold text-[var(--text-heading)] mb-4">
            {t('report.studyConsistency', 'Study Consistency')}
          </h2>
          <StudyHeatmap data={data.studyHeatmap} />
          <div className="flex items-center gap-2 mt-3 text-xs text-[var(--text-faint)]">
            <span>Less</span>
            <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: 'var(--border-card)' }} />
            <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: '#86efac' }} />
            <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: '#4ade80' }} />
            <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: '#16a34a' }} />
            <span>More</span>
          </div>
        </div>

        {/* ─── Topic Detail Table ─── */}
        <div className="report-section glass-card p-5 mb-6">
          <h2 className="text-lg font-bold text-[var(--text-heading)] mb-4">
            {t('report.topicDetails', 'Topic Details')}
          </h2>
          {data.topics.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t('report.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-card)]">
                    <th className="text-left py-2 text-[var(--text-muted)] font-medium">Topic</th>
                    <th className="text-left py-2 text-[var(--text-muted)] font-medium">Subject</th>
                    <th className="text-right py-2 text-[var(--text-muted)] font-medium">Mastery</th>
                    <th className="text-right py-2 text-[var(--text-muted)] font-medium">Attempted</th>
                    <th className="text-right py-2 text-[var(--text-muted)] font-medium">Correct</th>
                    <th className="text-right py-2 text-[var(--text-muted)] font-medium">Accuracy</th>
                    <th className="text-left py-2 text-[var(--text-muted)] font-medium">Next Review</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topics.map((topic, i) => (
                    <tr key={i} className="border-b border-[var(--border-card)]/50">
                      <td className="py-2 text-[var(--text-body)] font-medium">{topic.name}</td>
                      <td className="py-2 text-[var(--text-muted)]">{topic.subjectName}</td>
                      <td className="py-2 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${masteryBadgeClass(topic.mastery)}`}
                        >
                          {topic.mastery}%
                        </span>
                      </td>
                      <td className="py-2 text-right text-[var(--text-body)]">{topic.attempted}</td>
                      <td className="py-2 text-right text-[var(--text-body)]">{topic.correct}</td>
                      <td className="py-2 text-right text-[var(--text-body)]">
                        {topic.attempted > 0 ? `${topic.accuracy}%` : '-'}
                      </td>
                      <td className="py-2 text-[var(--text-muted)]">{topic.nextReview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── Weak Areas ─── */}
        {data.weakAreas.length > 0 && (
          <div className="report-section glass-card p-5 mb-6">
            <h2 className="text-lg font-bold text-[var(--text-heading)] mb-4">
              {t('report.weakAreas', 'Areas Needing Attention')}
            </h2>
            <div className="space-y-3">
              {data.weakAreas.map((area, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-card)]/50 border border-[var(--border-card)]/50"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: masteryColor(area.mastery) }}
                  >
                    {area.mastery}%
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-heading)]">{area.name}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{area.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Footer ─── */}
        <div className="report-section text-center text-xs text-[var(--text-faint)] py-6 border-t border-[var(--border-card)]">
          Generated by StudiesKit &middot; {generatedDate}
        </div>
      </div>
    </>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-4 text-center">
      <p className="text-2xl font-bold text-[var(--text-heading)]">{value}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">{label}</p>
    </div>
  )
}
