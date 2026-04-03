import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useExamProfile } from '../hooks/useExamProfile'
import { useAnalytics } from '../hooks/useAnalytics'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useProfileMode } from '../hooks/useProfileMode'
import { useProactiveInsights } from '../hooks/useProactiveInsights'
import { useSessionInsights } from '../hooks/useSessionInsights'
import { useSourceCoverage } from '../hooks/useSourceCoverage'
import { useStudentModel } from '../hooks/useStudentModel'
import { Link } from 'react-router-dom'
import { BarChart3, FileText, Lightbulb, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { FirstVisitHint } from '../components/FirstVisitHint'
import { useTranslation, Trans } from 'react-i18next'
import { CalibrationChart } from '../components/analytics/CalibrationChart'
import { ErrorPatternChart } from '../components/analytics/ErrorPatternChart'
import { MasteryTrendChart } from '../components/analytics/MasteryTrendChart'
import { ErrorDrillDown } from '../components/analytics/ErrorDrillDown'
import { computeCalibrationData } from '../lib/calibration'
import { computeErrorPatterns } from '../lib/errorPatterns'
import { computeMasteryHistory } from '../lib/analyticsEngine'
import { computeDailyRecommendations } from '../lib/studyRecommender'
import { db } from '../db'
import type { StudySession, MasterySnapshot } from '../db/schema'

// Relocated dashboard cards
import { StudyStreakCard } from '../components/dashboard/StudyStreakCard'
import { InsightCard } from '../components/dashboard/InsightCard'
import { IntelligenceBriefCard } from '../components/dashboard/IntelligenceBriefCard'
import { SessionInsightsCard } from '../components/dashboard/SessionInsightsCard'
import { AIProfileCard } from '../components/analytics/AIProfileCard'
import { ExamPatternsCard } from '../components/analytics/ExamPatternsCard'
import { MisconceptionCard } from '../components/analytics/MisconceptionCard'
import { LandscapeCard } from '../components/dashboard/LandscapeCard'
import { ResearchThreadsCard } from '../components/dashboard/ResearchThreadsCard'
import { WeakTopicsCard } from '../components/dashboard/WeakTopicsCard'
import { ActivityFeed } from '../components/dashboard/ActivityFeed'
import { TopicTree } from '../components/knowledge/TopicTree'

export default function Analytics() {
  const { t, i18n } = useTranslation()
  const { activeProfile } = useExamProfile()
  const { isResearch } = useProfileMode()
  const profileId = activeProfile?.id
  const { weeklyHours, sessionDistribution, subjectBalance, scoreTrend, topics, subjects, questionResults } = useAnalytics(profileId)
  const {
    subjects: kgSubjects, topics: kgTopics, weakTopics, streak, freezeUsed,
    weeklyHours: kgWeeklyHours, getTopicsForSubject, dailyLogs,
  } = useKnowledgeGraph(profileId)
  const insights = useProactiveInsights(profileId)
  const { recentInsights: sessionInsights } = useSessionInsights(profileId)
  const { coverage: sourceCoverage } = useSourceCoverage(profileId)
  const { studentModel } = useStudentModel(profileId)
  const [selectedTrendTopic, setSelectedTrendTopic] = useState<string>('')
  const [drillDownTopic, setDrillDownTopic] = useState<string | null>(null)
  const [drillDownType, setDrillDownType] = useState<string | null>(null)

  const masterySnapshots = useLiveQuery(
    () => profileId
      ? db.masterySnapshots.where('examProfileId').equals(profileId).toArray()
      : Promise.resolve([] as MasterySnapshot[]),
    [profileId]
  ) ?? []

  const sessions = useLiveQuery(
    () => profileId
      ? db.studySessions.where('examProfileId').equals(profileId).toArray()
      : Promise.resolve([] as StudySession[]),
    [profileId]
  ) ?? []

  const dueFlashcards = useLiveQuery(
    () => {
      const today = new Date().toISOString().slice(0, 10)
      return db.flashcards.where('nextReviewDate').belowOrEqual(today).count()
    }
  ) ?? 0

  const dueFlashcardsByTopic = useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const dueCards = await db.flashcards.where('nextReviewDate').belowOrEqual(today).toArray()
    const map = new Map<string, number>()
    for (const card of dueCards) {
      if (card.topicId) {
        map.set(card.topicId, (map.get(card.topicId) ?? 0) + 1)
      }
    }
    return map
  }) ?? new Map()

  const recommendations = useMemo(() => {
    if (!activeProfile || kgTopics.length === 0) return []
    const daysUntilExam = activeProfile.examDate
      ? Math.max(0, Math.ceil((new Date(activeProfile.examDate).getTime() - Date.now()) / 86400000))
      : 30

    let commonMistakes: string[] | undefined
    if (studentModel?.commonMistakes) {
      try { commonMistakes = JSON.parse(studentModel.commonMistakes) } catch { /* ignore */ }
    }

    const prerequisiteGraph = new Map<string, string[]>()
    const topicMasteryMap = new Map<string, number>()
    for (const t of kgTopics) {
      topicMasteryMap.set(t.id, t.mastery)
      if (t.prerequisiteTopicIds && t.prerequisiteTopicIds.length > 0) {
        prerequisiteGraph.set(t.id, t.prerequisiteTopicIds)
      }
    }

    return computeDailyRecommendations({
      topics: kgTopics,
      subjects: kgSubjects,
      daysUntilExam,
      dueFlashcardsByTopic,
      commonMistakes,
      prerequisiteGraph: prerequisiteGraph.size > 0 ? prerequisiteGraph : undefined,
      topicMasteryMap,
    })
  }, [activeProfile, kgTopics, kgSubjects, dueFlashcardsByTopic, studentModel])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          icon={BarChart3}
          title={t('emptyState.analyticsNoProfile.title')}
          subtitle={t('emptyState.analyticsNoProfile.subtitle')}
          actions={[{ label: t('emptyState.analyticsNoProfile.cta'), to: '/exam-profile' }]}
        />
      </div>
    )
  }

  const calibrationData = computeCalibrationData(topics, subjects)
  const errorPatterns = computeErrorPatterns(questionResults, topics)
  const maxHours = Math.max(...weeklyHours.map(d => d.hours), 1)

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      {activeProfile && (
        <FirstVisitHint
          hintKey="analytics"
          profileId={activeProfile.id}
          icon={BarChart3}
          title={t('hints.analyticsTitle')}
          description={t('hints.analyticsDescription')}
        />
      )}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('analytics.title')}</h1>
        <Link to="/report" className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> {t('report.generateReport', 'Export Report')}
        </Link>
      </div>
      <p className="text-sm text-[var(--text-muted)] mb-2">{t('analytics.subtitle')}</p>

      {/* Section navigation */}
      <nav className="flex gap-3 mb-6 text-sm overflow-x-auto pb-1">
        <a href="#study-hours" className="text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors whitespace-nowrap">{t('analytics.studyTime')}</a>
        <a href="#insights" className="text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors whitespace-nowrap">{t('analytics.insights', 'Insights')}</a>
        <a href="#knowledge" className="text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors whitespace-nowrap">{t('analytics.knowledgeMap', 'Knowledge Map')}</a>
        <a href="#exams" className="text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors whitespace-nowrap">{t('analytics.exams', 'Exams')}</a>
      </nav>

      {/* ─── Study Hours ─── */}
      <div id="study-hours" className="glass-card p-4 mb-4">
        <h2 className="font-semibold text-[var(--text-heading)] mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--accent-text)]" /> {t('analytics.studyTime')}
        </h2>
        <div className="flex items-end gap-2 h-40">
          {weeklyHours.map(d => {
            const pct = maxHours > 0 ? (d.hours / maxHours) * 100 : 0
            const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString(i18n.language, { weekday: 'short' })
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-[var(--text-muted)]">{d.hours.toFixed(1)}h</span>
                <div className="w-full rounded-t-md bg-[var(--accent-text)]/80 transition-all duration-300" style={{ height: `${Math.max(pct, 2)}%` }} />
                <span className="text-xs text-[var(--text-faint)]">{dayLabel}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subject Balance */}
        <div className="glass-card p-4">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">{t('analytics.subjectBalance')}</h2>
          {subjectBalance.length === 0 ? (
            <EmptyState icon={BarChart3} title={t('emptyState.analyticsNoData.title')} subtitle={t('emptyState.analyticsNoData.subtitle')} compact />
          ) : (
            <div className="space-y-3">
              {subjectBalance.map(s => (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--text-body)]">{s.name}</span>
                    <span className="text-[var(--text-muted)]">
                      {s.actual.toFixed(0)}% actual / {s.weight}% target
                    </span>
                  </div>
                  <div className="relative w-full h-2 rounded-full bg-[var(--border-card)] overflow-hidden">
                    <div
                      className="absolute h-full rounded-full opacity-80 transition-all"
                      style={{ width: `${Math.min(s.actual, 100)}%`, backgroundColor: s.color }}
                    />
                    <div
                      className="absolute h-full w-0.5 bg-[var(--text-heading)]"
                      style={{ left: `${Math.min(s.weight, 100)}%` }}
                      title={`Target: ${s.weight}%`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session Distribution */}
        <div className="glass-card p-4">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">{t('analytics.sessionTypes')}</h2>
          {sessionDistribution.length === 0 ? (
            <EmptyState icon={BarChart3} title={t('emptyState.analyticsNoData.title')} subtitle={t('emptyState.analyticsNoData.subtitle')} compact />
          ) : (
            <div className="space-y-2">
              {sessionDistribution.map(s => (
                <div key={s.type} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-body)] capitalize">{s.type.replace('-', ' ')}</span>
                  <span className="text-[var(--text-muted)]">{s.count} sessions &middot; {s.totalMinutes}m</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Score Trend */}
        <div className="glass-card p-4 md:col-span-2">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">{t('analytics.scoreTrend')}</h2>
          {scoreTrend.length === 0 ? (
            <EmptyState icon={BarChart3} title={t('emptyState.analyticsNoData.title')} subtitle={t('emptyState.analyticsNoData.subtitle')} compact />
          ) : (
            <div className="h-32 flex items-end gap-px">
              {scoreTrend.map((point, i) => (
                <div
                  key={i}
                  className="flex-1 bg-[var(--accent-text)]/60 rounded-t-sm transition-all"
                  style={{ height: `${point.score}%` }}
                  title={`${point.score.toFixed(0)}%`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Exam Scores */}
        <div id="exams" className="md:col-span-2" />
        <SimulationExamScoresCard examProfileId={profileId} passingThreshold={activeProfile.passingThreshold} />
        <MockExamScoresCard examProfileId={profileId} />

        {/* Mastery Trend */}
        <div className="glass-card p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[var(--text-heading)]">{t('analytics.masteryTrend')}</h2>
            <select
              value={selectedTrendTopic}
              onChange={e => setSelectedTrendTopic(e.target.value)}
              className="text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-2 py-1 text-[var(--text-body)]"
            >
              <option value="">{t('analytics.selectTopic')}</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <MasteryTrendChart
            data={selectedTrendTopic ? computeMasteryHistory(masterySnapshots, selectedTrendTopic, 30) : []}
            topicName={topics.find(t => t.id === selectedTrendTopic)?.name ?? 'Select a topic'}
          />
        </div>

        {/* Confidence Calibration */}
        <div className="glass-card p-4 md:col-span-2">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">{t('analytics.calibration')}</h2>
          <CalibrationChart data={calibrationData} />
        </div>

        {/* Error Patterns */}
        <div className="glass-card p-4 md:col-span-2">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">{t('analytics.errorPatterns')}</h2>
          <ErrorPatternChart
            data={errorPatterns}
            onDrillDown={(topicName, errorType) => {
              setDrillDownTopic(topicName)
              setDrillDownType(errorType)
            }}
          />
        </div>

        {/* Error Drill-Down Modal */}
        {drillDownTopic && drillDownType && (
          <ErrorDrillDown
            topicName={drillDownTopic}
            errorType={drillDownType}
            examProfileId={profileId ?? ''}
            onClose={() => { setDrillDownTopic(null); setDrillDownType(null) }}
          />
        )}
      </div>

      {/* ─── Insights ─── */}
      <h2 id="insights" className="text-lg font-bold text-[var(--text-heading)] mt-8 mb-4">
        {t('analytics.insights', 'Insights')}
      </h2>

      <StudyStreakCard
        streak={streak}
        weeklyHours={kgWeeklyHours}
        weeklyTarget={activeProfile.weeklyTargetHours}
        freezeUsed={freezeUsed}
        dailyLogs={dailyLogs}
      />

      <div className="mt-4">
        <InsightCard insights={insights} />
      </div>

      {profileId && (
        <div className="mt-4">
          <AIProfileCard studentModel={studentModel} profileId={profileId} />
        </div>
      )}

      {profileId && (
        <div className="mt-4">
          <MisconceptionCard examProfileId={profileId} />
        </div>
      )}

      {/* Coach Insights from Progress Monitor agent */}
      <CoachInsightsSection examProfileId={profileId} />

      {profileId && (
        <div className="mt-4">
          <ExamPatternsCard examProfileId={profileId} />
        </div>
      )}

      <div className="mt-4">
        <IntelligenceBriefCard
          recommendations={recommendations}
          insights={insights}
          dueFlashcardCount={dueFlashcards}
        />
      </div>

      {sessionInsights.length > 0 && (
        <div className="mt-4">
          <SessionInsightsCard insights={sessionInsights} />
        </div>
      )}

      {/* ─── Knowledge Map ─── */}
      <h2 id="knowledge" className="text-lg font-bold text-[var(--text-heading)] mt-8 mb-4">
        {t('analytics.knowledgeMap', 'Knowledge Map')}
      </h2>

      {isResearch ? (
        <ResearchThreadsCard topics={weakTopics.length > 0 ? weakTopics : kgTopics} subjects={kgSubjects} />
      ) : (
        <LandscapeCard topics={kgTopics} subjects={kgSubjects} />
      )}

      {!isResearch && weakTopics.length > 0 && (
        <div className="mt-4">
          <WeakTopicsCard topics={weakTopics} subjects={kgSubjects} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <ActivityFeed sessions={sessions} />
        <div className="glass-card p-4">
          <h3 className="font-semibold text-[var(--text-heading)] mb-3">{t('dashboard.knowledgeGraph')}</h3>
          <TopicTree subjects={kgSubjects} getTopicsForSubject={getTopicsForSubject} showStatus={isResearch} />
        </div>
      </div>

      {sourceCoverage && sourceCoverage.totalTopics > 0 && (
        <div className="glass-card p-3 mt-4 flex items-center justify-between">
          <span className="text-sm text-[var(--text-body)]">
            <Trans
              i18nKey="dashboard.sourceCoverage"
              values={{ percent: sourceCoverage.coveragePercent }}
              components={{ 1: <strong /> }}
            />
          </span>
          <Link to="/sources" className="text-xs text-[var(--accent-text)] hover:underline">{t('dashboard.viewSources')}</Link>
        </div>
      )}
    </div>
  )
}

// ─── Coach Insights from agent swarm ──────────────────────────

function CoachInsightsSection({ examProfileId }: { examProfileId: string | undefined }) {
  const { t } = useTranslation()
  const insights = useLiveQuery(async () => {
    if (!examProfileId) return []
    const insight = await db.agentInsights.get(`progress-monitor:${examProfileId}`)
    if (!insight) return []
    try {
      const all = JSON.parse(insight.data) as Array<{ type: string; urgency: string; title: string; message: string; surface: string; action?: { label: string; route: string } }>
      return all.filter(i => i.surface === 'analytics')
    } catch { return [] }
  }, [examProfileId]) ?? []

  if (insights.length === 0) return null

  return (
    <div className="mt-4 glass-card p-5">
      <h3 className="text-sm font-bold text-[var(--text-heading)] mb-3 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-[var(--accent-text)]" /> {t('analytics.coachInsights')}
      </h3>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
              insight.urgency === 'urgent' ? 'bg-red-500/5 text-[var(--text-body)]' :
              insight.urgency === 'attention' ? 'bg-amber-500/5 text-[var(--text-body)]' :
              'bg-blue-500/5 text-[var(--text-muted)]'
            }`}
          >
            <span className="mt-0.5 shrink-0">
              {insight.urgency === 'urgent' ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> : insight.urgency === 'attention' ? <BarChart3 className="w-3.5 h-3.5 text-amber-500" /> : <Sparkles className="w-3.5 h-3.5 text-blue-500" />}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-[var(--text-heading)]">{insight.title}</span>
              <span className="text-[var(--text-muted)] ml-1">{insight.message}</span>
              {insight.action && (
                <Link
                  to={insight.action.route}
                  className="inline-flex items-center gap-1 text-[var(--accent-text)] hover:underline font-medium mt-1"
                >
                  {insight.action.label} <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mock Exam Scores card ────────────────────────────────────

function MockExamScoresCard({ examProfileId }: { examProfileId: string | undefined }) {
  const { t } = useTranslation()
  const exams = useLiveQuery(async () => {
    if (!examProfileId) return []
    const all = await db.mockExams.where('examProfileId').equals(examProfileId).toArray()
    return all
      .filter(e => e.status === 'graded' && e.totalScore != null && e.maxScore != null && e.maxScore > 0)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [examProfileId]) ?? []

  if (exams.length === 0) return null

  const maxPct = 100
  return (
    <div className="glass-card p-4 md:col-span-2">
      <h2 className="font-semibold text-[var(--text-heading)] mb-3">{t('analytics.mockExamScores', 'Mock Exam Scores')}</h2>
      <div className="h-32 flex items-end gap-2">
        {exams.map((exam, i) => {
          const pct = Math.round((exam.totalScore! / exam.maxScore!) * 100)
          const passed = pct >= 60
          const dateLabel = new Date(exam.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          return (
            <div key={exam.id} className="flex-1 flex flex-col items-center gap-1 max-w-[60px]">
              <span className={`text-xs font-bold ${passed ? 'text-emerald-500' : 'text-red-500'}`}>{pct}%</span>
              <div
                className={`w-full rounded-t-sm transition-all ${passed ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                style={{ height: `${Math.max((pct / maxPct) * 100, 4)}%` }}
                title={`${pct}% — ${new Date(exam.startTime).toLocaleDateString()}`}
              />
              <span className="text-[10px] text-[var(--text-faint)]">{dateLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Simulation Exam Scores card ──────────────────────────────

function SimulationExamScoresCard({ examProfileId, passingThreshold }: { examProfileId: string | undefined; passingThreshold?: number }) {
  const { t } = useTranslation()
  const threshold = passingThreshold ?? 60
  const exams = useLiveQuery(async () => {
    if (!examProfileId) return []
    const all = await db.practiceExamSessions
      .where('examProfileId').equals(examProfileId)
      .filter(s => !!s.simulationMode && s.phase === 'graded' && s.totalScore != null && s.maxScore != null && s.maxScore! > 0)
      .toArray()
    return all.sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))
  }, [examProfileId]) ?? []

  if (exams.length === 0) return null

  // Compute predicted score for reference line
  let predicted: number | null = null
  if (exams.length >= 2) {
    const recent = exams.slice(-5)
    let ws = 0, wt = 0
    recent.forEach((s, i) => { const w = i + 1; ws += (s.totalScore! / s.maxScore!) * 100 * w; wt += w })
    predicted = Math.round(ws / wt)
  }

  return (
    <div className="glass-card p-4 md:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-[var(--text-heading)]">{t('analytics.simulationScores', 'Simulation Exam Scores')}</h2>
        {predicted != null && (
          <span className={`text-xs font-bold ${predicted >= threshold ? 'text-emerald-500' : 'text-amber-500'}`}>
            {t('dashboard.predicted', 'Predicted: {{score}}%', { score: predicted })}
          </span>
        )}
      </div>
      <div className="relative h-32">
        {/* Passing threshold line */}
        <div
          className="absolute w-full border-t border-dashed border-[var(--text-faint)]/40"
          style={{ bottom: `${threshold}%` }}
        >
          <span className="absolute right-0 -top-3 text-[9px] text-[var(--text-faint)]">{threshold}%</span>
        </div>
        {/* Predicted score line */}
        {predicted != null && (
          <div
            className="absolute w-full border-t border-dashed border-[var(--accent-text)]/40"
            style={{ bottom: `${predicted}%` }}
          />
        )}
        {/* Bars */}
        <div className="h-full flex items-end gap-2">
          {exams.map(exam => {
            const pct = Math.round((exam.totalScore! / exam.maxScore!) * 100)
            const passed = pct >= threshold
            const dateLabel = new Date(exam.completedAt ?? exam.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            return (
              <div key={exam.id} className="flex-1 flex flex-col items-center gap-1 max-w-[60px]">
                <span className={`text-xs font-bold ${passed ? 'text-emerald-500' : 'text-red-500'}`}>{pct}%</span>
                <div
                  className={`w-full rounded-t-sm transition-all ${passed ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                  style={{ height: `${Math.max(pct, 4)}%` }}
                  title={`${pct}% — ${new Date(exam.completedAt ?? exam.createdAt).toLocaleDateString()}`}
                />
                <span className="text-[10px] text-[var(--text-faint)]">{dateLabel}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
