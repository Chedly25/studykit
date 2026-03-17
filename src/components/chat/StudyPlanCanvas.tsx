import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ChevronDown, ChevronRight, Check, ArrowLeft, RefreshCw, Save, ExternalLink } from 'lucide-react'
import { useChatContext } from './ChatContext'
import { useStudyPlanCanvas } from '../../hooks/useStudyPlanCanvas'

const ACTIVITY_LABELS: Record<string, string> = {
  read: 'Read',
  flashcards: 'Flashcards',
  practice: 'Practice',
  socratic: 'Socratic',
  'explain-back': 'Explain Back',
  review: 'Review',
}

export function StudyPlanCanvas() {
  const { examProfileId, getToken } = useChatContext()
  const canvas = useStudyPlanCanvas(examProfileId)

  if (!examProfileId || !canvas.context) {
    return null
  }

  switch (canvas.mode) {
    case 'builder':
      return <BuilderMode canvas={canvas} getToken={getToken} />
    case 'generating':
      return <GeneratingMode />
    case 'result':
      return <ResultMode canvas={canvas} getToken={getToken} />
    case 'completed':
      return <CompletedMode canvas={canvas} />
    default:
      return null
  }
}

// ─── Builder Mode ────────────────────────────────────────────────

function BuilderMode({
  canvas,
  getToken,
}: {
  canvas: ReturnType<typeof useStudyPlanCanvas>
  getToken: () => Promise<string | null>
}) {
  const { context, topicsBySubject, weekStart, setWeekStart, dailyHours, setDailyHours, selectedTopicIds, selectedActivityTypes, toggleTopic, toggleActivityType, generate, error } = canvas
  if (!context) return null

  const handleGenerate = async () => {
    const token = await getToken()
    if (token) await generate(token)
  }

  return (
    <div className="glass-card p-4 my-3 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-2">
        Study Plan Builder
      </h3>

      {/* Context bar */}
      <div className="text-xs text-[var(--text-muted)] flex flex-wrap gap-x-3 gap-y-1">
        <span>{context.examName}</span>
        {context.daysLeft !== null && <span>{context.daysLeft} days left</span>}
        <span>{context.readiness}% ready</span>
        {context.streak > 0 && <span>{context.streak}-day streak</span>}
      </div>

      {/* Week start + daily hours */}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--text-body)]">Week starting</span>
          <input
            type="date"
            value={weekStart}
            onChange={e => setWeekStart(e.target.value)}
            className="w-full text-sm px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-body)]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--text-body)]">Hours/day</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.5}
              max={8}
              step={0.5}
              value={dailyHours}
              onChange={e => setDailyHours(parseFloat(e.target.value))}
              className="flex-1 accent-[var(--accent-text)]"
            />
            <span className="text-sm font-medium text-[var(--text-body)] w-10 text-right">{dailyHours}h</span>
          </div>
        </label>
      </div>

      {/* Topic selection */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-[var(--text-body)]">Topics to focus on</span>
        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
          {topicsBySubject.map(group => (
            <TopicGroup
              key={group.subject.id}
              subjectName={group.subject.name}
              topics={group.topics}
              selectedIds={selectedTopicIds}
              onToggle={toggleTopic}
            />
          ))}
          {topicsBySubject.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] py-2">No topics yet — add subjects and topics first.</p>
          )}
        </div>
      </div>

      {/* Activity types */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-[var(--text-body)]">Activities</span>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(ACTIVITY_LABELS).map(([type, label]) => (
            <button
              key={type}
              onClick={() => toggleActivityType(type)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                selectedActivityTypes.has(type)
                  ? 'bg-[var(--accent-bg)] border-[var(--accent-text)] text-[var(--accent-text)]'
                  : 'border-[var(--border-card)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
              }`}
            >
              {label} {selectedActivityTypes.has(type) && <Check className="w-3 h-3 inline ml-0.5 -mt-0.5" />}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={selectedTopicIds.size === 0}
        className="btn-primary w-full py-2 text-sm disabled:opacity-50"
      >
        Generate Plan
      </button>
    </div>
  )
}

// ─── Topic Group ─────────────────────────────────────────────────

function TopicGroup({
  subjectName,
  topics,
  selectedIds,
  onToggle,
}: {
  subjectName: string
  topics: Array<{ id: string; name: string; decayed: number }>
  selectedIds: Set<string>
  onToggle: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border border-[var(--border-card)] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-heading)] hover:bg-[var(--bg-input)] transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {subjectName}
      </button>
      {expanded && (
        <div className="border-t border-[var(--border-card)]">
          {topics.map(t => (
            <label
              key={t.id}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--bg-input)] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(t.id)}
                onChange={() => onToggle(t.id)}
                className="accent-[var(--accent-text)] rounded"
              />
              <span className="text-xs text-[var(--text-body)] flex-1 truncate">{t.name}</span>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">{Math.round(t.decayed * 100)}%</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Generating Mode ─────────────────────────────────────────────

function GeneratingMode() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="glass-card p-6 my-3 flex flex-col items-center gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-text)]" />
      <p className="text-sm text-[var(--text-body)]">
        Generating your study plan{elapsed > 0 ? ` (${elapsed}s)` : ''}...
      </p>
    </div>
  )
}

// ─── Result Mode ─────────────────────────────────────────────────

function ResultMode({
  canvas,
  getToken,
}: {
  canvas: ReturnType<typeof useStudyPlanCanvas>
  getToken: () => Promise<string | null>
}) {
  const { draftData, backToBuilder, generate, save, error } = canvas
  if (!draftData || draftData.days.length === 0) return null

  const firstDate = draftData.days[0].date
  const lastDate = draftData.days[draftData.days.length - 1].date
  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00')
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const handleRegenerate = async () => {
    const token = await getToken()
    if (token) await generate(token)
  }

  return (
    <div className="glass-card p-4 my-3 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-heading)]">
        Plan: {formatDate(firstDate)} – {formatDate(lastDate)}
      </h3>

      <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
        {draftData.days.map(day => {
          const date = new Date(day.date + 'T12:00:00')
          const dayLabel = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }).toUpperCase()
          return (
            <div key={day.date}>
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1 border-b border-[var(--border-card)] pb-1">
                {dayLabel}
              </div>
              <div className="space-y-0.5">
                {day.activities.map((act, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-body)]">
                    <span className="flex-1 truncate">{act.topicName}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent-text)] whitespace-nowrap">
                      {ACTIVITY_LABELS[act.activityType] ?? act.activityType}
                    </span>
                    <span className="text-[var(--text-muted)] tabular-nums w-10 text-right">{act.durationMinutes}m</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button onClick={backToBuilder} className="btn-secondary flex-1 py-1.5 text-sm flex items-center justify-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <button onClick={handleRegenerate} className="btn-secondary flex-1 py-1.5 text-sm flex items-center justify-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Regenerate
        </button>
        <button onClick={save} className="btn-primary flex-1 py-1.5 text-sm flex items-center justify-center gap-1.5">
          <Save className="w-3.5 h-3.5" /> Save & Activate
        </button>
      </div>
    </div>
  )
}

// ─── Completed Mode ──────────────────────────────────────────────

function CompletedMode({ canvas }: { canvas: ReturnType<typeof useStudyPlanCanvas> }) {
  const { activePlan, activePlanDays } = canvas
  if (!activePlan) return null

  const firstDate = activePlanDays[0]?.date
  const lastDate = activePlanDays[activePlanDays.length - 1]?.date
  const formatDate = (d: string | undefined) => {
    if (!d) return ''
    return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className="glass-card p-4 my-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="w-3 h-3 text-green-600" />
        </div>
        <span className="text-[var(--text-body)]">
          Study plan active — {activePlan.totalDays} days{firstDate && lastDate ? `, ${formatDate(firstDate)}–${formatDate(lastDate)}` : ''}
        </span>
      </div>
      <Link
        to="/study-plan"
        className="text-xs text-[var(--accent-text)] hover:underline flex items-center gap-1 whitespace-nowrap"
      >
        View full plan <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  )
}
