import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronRight } from 'lucide-react'

interface TourStep {
  target: string // data-tour attribute value
  title: string
  description: string
}

const STEPS: TourStep[] = [
  {
    target: 'queue',
    title: 'Your Daily Queue',
    description: 'Start here each day — flashcards, exercises, and study tasks tailored to your exam.',
  },
  {
    target: 'study',
    title: 'Study Sessions',
    description: 'Chat with your AI tutor, review concepts, and practice active recall.',
  },
  {
    target: 'library',
    title: 'Your Library',
    description: 'Upload course materials, past exams, and notes — the AI will analyze them for you.',
  },
  {
    target: 'progress',
    title: 'Track Progress',
    description: 'See your mastery levels, streaks, and knowledge gaps across all subjects.',
  },
  {
    target: 'exams',
    title: 'Practice Exams',
    description: 'Simulate real exam conditions with AI-generated questions in your exam format.',
  },
]

interface OnboardingTourProps {
  profileId: string
}

export function OnboardingTour({ profileId }: OnboardingTourProps) {
  const storageKey = `dashboard_tour_complete_${profileId}`
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; arrowLeft: boolean } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (localStorage.getItem(storageKey)) return
    // Small delay to let the sidebar render
    const timer = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(timer)
  }, [storageKey])

  const positionTooltip = useCallback(() => {
    if (!visible || step >= STEPS.length) return
    const target = document.querySelector(`[data-tour="${STEPS[step].target}"]`)
    if (!target) return

    const rect = target.getBoundingClientRect()
    setPos({
      top: rect.top + rect.height / 2 - 60,
      left: rect.right + 12,
      arrowLeft: true,
    })
  }, [visible, step])

  useEffect(() => {
    positionTooltip()
    window.addEventListener('resize', positionTooltip)
    return () => window.removeEventListener('resize', positionTooltip)
  }, [positionTooltip])

  const dismiss = useCallback(() => {
    localStorage.setItem(storageKey, 'true')
    setVisible(false)
  }, [storageKey])

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) {
      dismiss()
    } else {
      setStep(s => s + 1)
    }
  }, [step, dismiss])

  if (!visible || !pos) return null

  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={dismiss} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-[91] pointer-events-auto glass-card shadow-xl rounded-xl p-4 w-72 animate-fade-in"
        style={{ top: pos.top, left: pos.left }}
      >
        {/* Arrow */}
        <div
          className="absolute w-2 h-2 bg-[var(--bg-card)] border-l border-b border-[var(--border-card)] rotate-45"
          style={{ left: -5, top: 24 }}
        />

        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">{current.title}</h3>
          <button onClick={dismiss} className="text-[var(--text-faint)] hover:text-[var(--text-muted)] -mt-1 -mr-1 p-1">
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">{current.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === step ? 'bg-[var(--accent-text)]' : 'bg-[var(--border-card)]'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={dismiss} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]">
              Skip
            </button>
            <button
              onClick={next}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium btn-primary"
            >
              {step === STEPS.length - 1 ? 'Done' : 'Next'}
              {step < STEPS.length - 1 && <ChevronRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
