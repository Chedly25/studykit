/**
 * Conversational onboarding page — /welcome route.
 * Structured chat-like flow for first-time users.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Upload, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { useOnboarding } from '../hooks/useOnboarding'
import { useExamProfile } from '../hooks/useExamProfile'
import type { OnboardingStep, OnboardingMessage, OnboardingWidget, OnboardingSummary } from '../ai/workflows/onboardingFlow'
import type { ExtractedSubject } from '../ai/topicExtractor'

// ─── Progress dots ────────────────────────────────────────

const STEPS: OnboardingStep[] = ['welcome', 'self-assessment', 'materials', 'capacity', 'summary']

function OnboardingProgress({ step }: { step: OnboardingStep }) {
  const currentIdx = STEPS.indexOf(step)
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            i <= currentIdx ? 'bg-[var(--accent-text)]' : 'bg-[var(--bg-input)]'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Message bubbles ──────────────────────────────────────

function MessageBubble({ message }: { message: OnboardingMessage }) {
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

// ─── Input widgets ────────────────────────────────────────

function ExamInputWidget({ onSubmit, disabled }: { onSubmit: (text: string) => void; disabled: boolean }) {
  const [value, setValue] = useState('')
  const handleSubmit = () => { if (value.trim()) { onSubmit(value.trim()); setValue('') } }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
        placeholder="e.g., California Bar Exam, MCAT, Organic Chemistry..."
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
          onClick={() => onSubmit(noDeadline ? '' : date)}
          disabled={disabled || (!date && !noDeadline)}
          className="btn-primary px-4 py-3 rounded-xl"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
        <input type="checkbox" checked={noDeadline} onChange={e => setNoDeadline(e.target.checked)} className="rounded" />
        No fixed deadline
      </label>
    </div>
  )
}

function TextAreaWidget({ onSubmit, disabled, placeholder }: { onSubmit: (text: string) => void; disabled: boolean; placeholder: string }) {
  const [value, setValue] = useState('')
  const handleSubmit = () => { if (value.trim()) { onSubmit(value.trim()); setValue('') } }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] resize-none"
        disabled={disabled}
        autoFocus
      />
      <button onClick={handleSubmit} disabled={disabled || !value.trim()} className="btn-primary w-full py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
        Continue <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function ChoiceWidget({ options, onSelect, disabled }: { options: Array<{ id: string; label: string; description?: string }>; onSelect: (id: string) => void; disabled: boolean }) {
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
        Continue <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function TopicPreviewWidget({ subjects, onConfirm, disabled }: { subjects: ExtractedSubject[]; onConfirm: () => void; disabled: boolean }) {
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
                  {ch.topics.map((t, ti) => <div key={ti} className="ml-3">• {t.name}</div>)}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <button onClick={onConfirm} disabled={disabled} className="btn-primary w-full py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
        <Check className="w-4 h-4" /> Looks good
      </button>
    </div>
  )
}

function SummaryWidget({ data, onDashboard, onStudy, disabled }: {
  data: OnboardingSummary; onDashboard: () => void; onStudy: () => void; disabled: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="glass-card p-5 space-y-3">
        <h3 className="font-semibold text-[var(--text-heading)]">Your study plan is ready</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Exam</span>
            <span className="text-[var(--text-body)] font-medium">{data.examName}</span>
          </div>
          {data.examDate && (
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Date</span>
              <span className="text-[var(--text-body)] font-medium">{new Date(data.examDate + 'T12:00:00').toLocaleDateString()}</span>
            </div>
          )}
          {data.subjectCount > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Subjects</span>
              <span className="text-[var(--text-body)] font-medium">{data.subjectCount} subjects, {data.topicCount} topics</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Weekly target</span>
            <span className="text-[var(--text-body)] font-medium">{data.weeklyHours} hours/week</span>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-card)]">
          Your first study plan is being generated. Your queue will be ready when you arrive.
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={onDashboard} disabled={disabled} className="btn-secondary flex-1 py-3 text-sm font-semibold rounded-xl">
          Go to Dashboard
        </button>
        <button onClick={onStudy} disabled={disabled} className="btn-primary flex-1 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
          Start Studying <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Current input area ───────────────────────────────────

function InputArea({ widget, onInput, disabled }: {
  widget: OnboardingWidget | undefined
  onInput: (input: Record<string, unknown>) => void
  disabled: boolean
}) {
  if (!widget) return null

  switch (widget.type) {
    case 'exam-input':
      return <ExamInputWidget onSubmit={text => onInput({ text })} disabled={disabled} />
    case 'date-input':
      return <DateInputWidget onSubmit={date => onInput({ examDate: date })} disabled={disabled} />
    case 'text-area':
      return <TextAreaWidget onSubmit={text => onInput({ text })} disabled={disabled} placeholder={widget.placeholder} />
    case 'choice':
      return <ChoiceWidget options={widget.options} onSelect={id => onInput({ choice: id })} disabled={disabled} />
    case 'slider':
      return <SliderWidget {...widget} onSubmit={v => onInput({ weeklyHours: v })} disabled={disabled} />
    case 'topic-preview':
      return <TopicPreviewWidget subjects={widget.subjects} onConfirm={() => onInput({ choice: 'confirm-topics' })} disabled={disabled} />
    case 'summary':
      return null // Summary widget is rendered inline
    default:
      return null
  }
}

// ─── Main page ────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate()
  const { state, sendMessage, completeOnboarding } = useOnboarding()
  const { profiles, profilesLoaded } = useExamProfile()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Redirect if user already has profiles (not from this onboarding)
  useEffect(() => {
    if (profilesLoaded && profiles.length > 0 && !state.profileId) {
      navigate('/dashboard', { replace: true })
    }
  }, [profilesLoaded, profiles.length, state.profileId, navigate])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages.length])

  const handleInput = async (input: Record<string, unknown>) => {
    await sendMessage(input)
  }

  const handleComplete = async (destination: string) => {
    await completeOnboarding()
    navigate(destination, { replace: true })
  }

  // Find the last widget in messages
  const lastMessage = state.messages[state.messages.length - 1]
  const activeWidget = lastMessage?.widget

  return (
    <div className="max-w-xl mx-auto py-8 px-4 min-h-[80vh] flex flex-col animate-fade-in">
      <OnboardingProgress step={state.step} />

      {/* Messages */}
      <div className="flex-1 space-y-1 mb-6">
        {state.messages.map(m => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {/* Inline summary widget */}
        {activeWidget?.type === 'summary' && (
          <div className="mt-4">
            <SummaryWidget
              data={(activeWidget as { type: 'summary'; data: OnboardingSummary }).data}
              onDashboard={() => handleComplete('/dashboard')}
              onStudy={() => handleComplete('/queue')}
              disabled={state.isProcessing}
            />
          </div>
        )}

        {/* Processing indicator */}
        {state.isProcessing && (
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
      {activeWidget?.type !== 'summary' && (
        <div className="sticky bottom-4">
          <InputArea widget={activeWidget} onInput={handleInput} disabled={state.isProcessing} />
        </div>
      )}
    </div>
  )
}
