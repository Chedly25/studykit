/**
 * Conversational onboarding page — /welcome route.
 * LLM-powered chat flow for first-time users.
 * Falls back to a guided setup message when AI is unavailable.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Upload, ChevronDown, ChevronUp, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { useOnboarding } from '../hooks/useOnboarding'
import { useExamProfile } from '../hooks/useExamProfile'
import type { DisplayMessage, PendingWidget } from '../ai/workflows/onboardingAgent'
import type { ExtractedSubject } from '../ai/topicExtractor'

// ─── Progress milestones ─────────────────────────────────

interface MilestoneProps {
  profileId: string | null
  topicsSeeded: boolean
  weeklyHoursSet: boolean
}

function MilestoneIndicator({ profileId, topicsSeeded, weeklyHoursSet }: MilestoneProps) {
  const { t } = useTranslation()
  const milestones = [
    { label: t('onboarding.exam', 'Profile'), done: profileId !== null },
    { label: t('onboarding.subjects', 'Topics'), done: topicsSeeded },
    { label: t('onboarding.weeklyTarget', 'Plan'), done: weeklyHoursSet },
  ]

  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      {milestones.map((m, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
              m.done
                ? 'bg-emerald-500 text-white'
                : 'bg-[var(--bg-input)] text-[var(--text-faint)]'
            }`}
          >
            {m.done ? <Check className="w-3 h-3" /> : i + 1}
          </div>
          <span className={`text-xs ${m.done ? 'text-emerald-600 font-medium' : 'text-[var(--text-faint)]'}`}>
            {m.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Message bubbles ──────────────────────────────────────

function MessageBubble({ message }: { message: DisplayMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-[var(--accent-text)] text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%] text-sm">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-3">
      <div className="bg-[var(--bg-input)] px-4 py-2.5 rounded-2xl rounded-bl-md max-w-[85%] text-sm text-[var(--text-body)] whitespace-pre-line">
        {message.content}
      </div>
    </div>
  )
}

function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-[var(--bg-input)] px-4 py-2.5 rounded-2xl rounded-bl-md max-w-[85%] text-sm text-[var(--text-body)] whitespace-pre-line">
        {text}
        <span className="inline-block w-1.5 h-4 bg-[var(--text-muted)] ml-0.5 animate-pulse rounded-sm align-text-bottom" />
      </div>
    </div>
  )
}

// ─── Input widgets ────────────────────────────────────────

function FreeTextInput({ onSubmit, disabled, placeholder }: { onSubmit: (text: string) => void; disabled: boolean; placeholder?: string }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const handleSubmit = () => { if (value.trim()) { onSubmit(value.trim()); setValue('') } }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
        placeholder={placeholder ?? t('onboarding.examPlaceholder')}
        className="flex-1 px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)]"
        disabled={disabled}
        autoFocus
      />
      <button onClick={handleSubmit} disabled={disabled || !value.trim()} className="btn-primary px-4 py-3 rounded-xl">
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function DateInputWidget({ onSubmit, disabled }: { onSubmit: (date: string) => void; disabled: boolean }) {
  const { t } = useTranslation()
  const [date, setDate] = useState('')
  const [noDeadline, setNoDeadline] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          min={today}
          onChange={e => setDate(e.target.value)}
          className="flex-1 px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl text-sm text-[var(--text-body)]"
          disabled={disabled || noDeadline}
        />
        <button
          onClick={() => onSubmit(noDeadline ? 'No deadline' : date)}
          disabled={disabled || (!date && !noDeadline)}
          className="btn-primary px-4 py-3 rounded-xl"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
        <input type="checkbox" checked={noDeadline} onChange={e => setNoDeadline(e.target.checked)} className="rounded" />
        {t('onboarding.noDeadline')}
      </label>
    </div>
  )
}

function FileUploadWidget({ onSubmit, disabled }: { onSubmit: (result: string) => void; disabled: boolean }) {
  const { t } = useTranslation()
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleSubmit = () => {
    if (files.length > 0) {
      onSubmit(`Uploaded ${files.length} file${files.length > 1 ? 's' : ''}`)
    }
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-[var(--border-card)] rounded-xl p-6 text-center cursor-pointer hover:border-[var(--accent-text)] transition-colors"
      >
        <Upload className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-2" />
        <p className="text-sm text-[var(--text-muted)]">
          {files.length > 0
            ? `${files.length} file${files.length > 1 ? 's' : ''} selected`
            : 'Click to upload PDFs, syllabi, or course materials'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          multiple
          onChange={handleFiles}
          className="hidden"
          disabled={disabled}
        />
      </div>
      {files.length > 0 && (
        <button onClick={handleSubmit} disabled={disabled} className="btn-primary w-full py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
          {t('common.continue', 'Continue')} <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// Kept for potential future use (e.g., choice-based widgets)
export function ChoiceWidget({ options, onSelect, disabled }: { options: Array<{ id: string; label: string; description?: string }>; onSelect: (id: string) => void; disabled: boolean }) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          disabled={disabled}
          className="w-full glass-card glass-card-hover p-4 text-left flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center shrink-0 mt-0.5">
            {opt.id === 'upload' ? <Upload className="w-4 h-4 text-[var(--accent-text)]" /> : <ArrowRight className="w-4 h-4 text-[var(--accent-text)]" />}
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--text-heading)]">{opt.label}</div>
            {opt.description && <div className="text-xs text-[var(--text-muted)] mt-0.5">{opt.description}</div>}
          </div>
        </button>
      ))}
    </div>
  )
}

function SliderWidget({ min, max, step, unit, defaultValue, onSubmit, disabled }: {
  min: number; max: number; step: number; unit: string; defaultValue: number
  onSubmit: (value: number) => void; disabled: boolean
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(defaultValue)

  return (
    <div className="space-y-4">
      <div className="text-center">
        <span className="text-3xl font-bold text-[var(--text-heading)]">{value}</span>
        <span className="text-sm text-[var(--text-muted)] ml-2">{unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        className="w-full accent-[var(--accent-text)]"
        disabled={disabled}
      />
      <div className="flex justify-between text-xs text-[var(--text-faint)]">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
      <button onClick={() => onSubmit(value)} disabled={disabled} className="btn-primary w-full py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
        {t('common.continue', 'Continue')} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function TopicPreviewWidget({ subjects, onConfirm, disabled }: { subjects: ExtractedSubject[]; onConfirm: () => void; disabled: boolean }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {subjects.map((s, i) => (
        <div key={i} className="glass-card overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === s.name ? null : s.name)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <div>
              <span className="text-sm font-medium text-[var(--text-heading)]">{s.name}</span>
              <span className="text-xs text-[var(--text-muted)] ml-2">{s.weight}%</span>
            </div>
            {expanded === s.name ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
          </button>
          {expanded === s.name && (
            <div className="px-4 pb-3 text-xs text-[var(--text-muted)] space-y-1">
              {(s.chapters ?? [{ name: '', topics: s.topics }]).map((ch, ci) => (
                <div key={ci}>
                  {ch.name && ch.name !== 'General' && <div className="font-medium text-[var(--text-body)] mt-1">{ch.name}</div>}
                  {ch.topics.map((tp, ti) => <div key={ti} className="ml-3">• {tp.name}</div>)}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <button onClick={onConfirm} disabled={disabled} className="btn-primary w-full py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
        <Check className="w-4 h-4" /> {t('onboarding.looksGood')}
      </button>
    </div>
  )
}

interface SummaryData {
  examName?: string
  examDate?: string
  subjectCount?: number
  topicCount?: number
  weeklyHours?: number
}

function SummaryWidget({ data, onDashboard, onStudy, disabled }: {
  data: SummaryData; onDashboard: () => void; onStudy: () => void; disabled: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <div className="glass-card p-5 space-y-3">
        <h3 className="font-semibold text-[var(--text-heading)]">{t('onboarding.planReady')}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">{t('onboarding.exam')}</span>
            <span className="text-[var(--text-body)] font-medium">{data.examName ?? '—'}</span>
          </div>
          {data.examDate && (
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t('onboarding.date')}</span>
              <span className="text-[var(--text-body)] font-medium">{new Date(data.examDate + 'T12:00:00').toLocaleDateString()}</span>
            </div>
          )}
          {(data.subjectCount ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t('onboarding.subjects')}</span>
              <span className="text-[var(--text-body)] font-medium">{data.subjectCount} subjects, {data.topicCount} topics</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">{t('onboarding.weeklyTarget')}</span>
            <span className="text-[var(--text-body)] font-medium">{data.weeklyHours ?? '—'} {t('onboarding.hoursPerWeek')}</span>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-card)]">
          {t('onboarding.planGenerating')}
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={onDashboard} disabled={disabled} className="btn-secondary flex-1 py-3 text-sm font-semibold rounded-xl">
          {t('onboarding.goToDashboard')}
        </button>
        <button onClick={onStudy} disabled={disabled} className="btn-primary flex-1 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
          {t('onboarding.startStudying')} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Error banner ─────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
      <span className="text-sm text-red-700 dark:text-red-300 flex-1">{message}</span>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  )
}

// ─── Fallback when AI unavailable ─────────────────────────

function FallbackOnboarding({ onReset }: { onReset: () => void }) {
  return (
    <div className="max-w-xl mx-auto py-16 px-4 text-center animate-fade-in">
      <div className="glass-card p-8 space-y-4">
        <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
        <h2 className="text-lg font-semibold text-[var(--text-heading)]">
          AI temporarily unavailable
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          We are using a guided setup experience that requires AI. Please try again in a moment.
        </p>
        <button
          onClick={onReset}
          className="btn-primary px-6 py-2.5 text-sm font-semibold rounded-xl inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    </div>
  )
}

// ─── Inline widget renderer (for widgets inside messages) ─

function InlineWidget({
  widget,
  extractedSubjects,
  respondToWidget,
  completeOnboarding,
  navigate,
  disabled,
}: {
  widget: { type: string; config: Record<string, unknown> }
  extractedSubjects: ExtractedSubject[]
  respondToWidget: (result: string) => void
  completeOnboarding: () => Promise<void>
  navigate: (path: string, opts?: { replace?: boolean }) => void
  disabled: boolean
}) {
  const handleComplete = async (destination: string) => {
    await completeOnboarding()
    navigate(destination, { replace: true })
  }

  switch (widget.type) {
    case 'topic-preview': {
      const subjects = (widget.config.subjects as ExtractedSubject[]) ?? extractedSubjects
      if (subjects.length === 0) return null
      return (
        <div className="mt-3">
          <TopicPreviewWidget
            subjects={subjects}
            onConfirm={() => respondToWidget('Confirmed')}
            disabled={disabled}
          />
        </div>
      )
    }
    case 'summary':
      return (
        <div className="mt-3">
          <SummaryWidget
            data={widget.config as unknown as SummaryData}
            onDashboard={() => handleComplete('/dashboard')}
            onStudy={() => handleComplete('/queue')}
            disabled={disabled}
          />
        </div>
      )
    default:
      return null
  }
}

// ─── Pending widget area (input widgets at bottom) ────────

function PendingWidgetArea({
  pendingWidget,
  extractedSubjects,
  respondToWidget,
  disabled,
}: {
  pendingWidget: PendingWidget
  extractedSubjects: ExtractedSubject[]
  respondToWidget: (result: string) => void
  disabled: boolean
}) {
  switch (pendingWidget.type) {
    case 'date-input':
      return <DateInputWidget onSubmit={date => respondToWidget(date)} disabled={disabled} />
    case 'file-upload':
      return <FileUploadWidget onSubmit={result => respondToWidget(result)} disabled={disabled} />
    case 'slider': {
      const cfg = pendingWidget.config
      return (
        <SliderWidget
          min={(cfg.min as number) ?? 5}
          max={(cfg.max as number) ?? 40}
          step={(cfg.step as number) ?? 5}
          unit="hours/week"
          defaultValue={(cfg.default as number) ?? 15}
          onSubmit={v => respondToWidget(String(v))}
          disabled={disabled}
        />
      )
    }
    case 'topic-preview': {
      const subjects = (pendingWidget.config.subjects as ExtractedSubject[]) ?? extractedSubjects
      return (
        <TopicPreviewWidget
          subjects={subjects}
          onConfirm={() => respondToWidget('Confirmed')}
          disabled={disabled}
        />
      )
    }
    case 'summary':
      // Summary is rendered inline — no pending input needed
      return null
    default:
      return null
  }
}

// ─── Main page ────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate()
  const { state, sendMessage, respondToWidget, completeOnboarding, resetOnboarding } = useOnboarding()
  const { profiles, profilesLoaded } = useExamProfile()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Redirect if user already has profiles (not from this onboarding)
  useEffect(() => {
    if (profilesLoaded && profiles.length > 0 && !state.profileId) {
      navigate('/dashboard', { replace: true })
    }
  }, [profilesLoaded, profiles.length, state.profileId, navigate])

  // Initial greeting — trigger AI opening message on mount
  useEffect(() => {
    if (state.displayMessages.length === 0 && !state.completed && !state.useFallback) {
      sendMessage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.displayMessages.length, state.streamingText])

  // ── Fallback ──────────────────────────────────────────
  if (state.useFallback) {
    return <FallbackOnboarding onReset={resetOnboarding} />
  }

  // Determine if we should show the free-text input
  const showFreeTextInput = !state.pendingWidget && !state.completed && !state.isStreaming

  return (
    <div className="max-w-xl mx-auto py-8 px-4 min-h-[80vh] flex flex-col animate-fade-in">
      <MilestoneIndicator
        profileId={state.profileId}
        topicsSeeded={state.topicsSeeded}
        weeklyHoursSet={state.weeklyHoursSet}
      />

      {/* Error banner */}
      {state.error && (
        <ErrorBanner message={state.error} onRetry={() => sendMessage()} />
      )}

      {/* Messages */}
      <div className="flex-1 space-y-1 mb-6">
        {state.displayMessages.map(m => (
          <div key={m.id}>
            <MessageBubble message={m} />
            {/* Render inline widgets (topic-preview, summary) below their message */}
            {m.widget && (
              <InlineWidget
                widget={m.widget}
                extractedSubjects={state.extractedSubjects}
                respondToWidget={respondToWidget}
                completeOnboarding={completeOnboarding}
                navigate={navigate}
                disabled={state.isStreaming}
              />
            )}
          </div>
        ))}

        {/* Streaming bubble */}
        {state.isStreaming && state.streamingText && (
          <StreamingBubble text={state.streamingText} />
        )}

        {/* Typing indicator when streaming but no text yet */}
        {state.isStreaming && !state.streamingText && (
          <div className="flex justify-start mb-3">
            <div className="bg-[var(--bg-input)] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm text-[var(--text-muted)]">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="sticky bottom-4">
        {state.pendingWidget && (
          <PendingWidgetArea
            pendingWidget={state.pendingWidget}
            extractedSubjects={state.extractedSubjects}
            respondToWidget={respondToWidget}
            disabled={state.isStreaming}
          />
        )}

        {showFreeTextInput && (
          <FreeTextInput
            onSubmit={text => sendMessage(text)}
            disabled={state.isStreaming}
          />
        )}
      </div>
    </div>
  )
}
