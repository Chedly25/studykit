/**
 * CRFPA-specific onboarding form — 3 structured questions.
 * No LLM, no chat. Creates the profile and redirects to /accueil.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, Scale } from 'lucide-react'
import { useExamProfile } from '../../hooks/useExamProfile'

interface Props {
  onBack: () => void
}

type Attempt = 'first' | 'second'

export function CRFPAOnboardingForm({ onBack }: Props) {
  const navigate = useNavigate()
  const { createProfile } = useExamProfile()

  const [examDate, setExamDate] = useState<string>('')
  const [noDeadline, setNoDeadline] = useState(false)
  const [weeklyHours, setWeeklyHours] = useState<number>(15)
  const [attempt, setAttempt] = useState<Attempt>('first')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = !submitting && (noDeadline || examDate.length > 0)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const dateValue = noDeadline ? '' : examDate
      const name = attempt === 'second' ? 'CRFPA (2ème tentative)' : 'CRFPA'
      await createProfile(name, 'professional-exam', dateValue, weeklyHours, 'study', 'crfpa')
      navigate('/accueil', { replace: true })
    } catch (err) {
      setError((err as Error).message || 'Impossible de créer le profil')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-4 min-h-[80vh] flex flex-col animate-fade-in">
      <button
        onClick={onBack}
        disabled={submitting}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors mb-6 self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[var(--accent-bg)] flex items-center justify-center">
          <Scale className="w-6 h-6 text-[var(--accent-text)]" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
            Prépa CRFPA
          </h1>
          <p className="text-sm text-[var(--text-muted)]">Trois questions et on démarre.</p>
        </div>
      </div>

      <div className="space-y-6 flex-1">
        {/* Date écrit */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--text-heading)]">
            Date de l'écrit
          </label>
          <input
            type="date"
            value={examDate}
            onChange={e => { setExamDate(e.target.value); setNoDeadline(false) }}
            disabled={submitting || noDeadline}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-text)] focus:outline-none disabled:opacity-50"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={noDeadline}
              onChange={e => { setNoDeadline(e.target.checked); if (e.target.checked) setExamDate('') }}
              disabled={submitting}
              className="rounded"
            />
            Date pas encore fixée
          </label>
        </div>

        {/* Heures / semaine */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-semibold text-[var(--text-heading)]">
              Heures par semaine
            </label>
            <span className="text-sm font-medium text-[var(--accent-text)] tabular-nums">
              {weeklyHours}h
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={40}
            step={1}
            value={weeklyHours}
            onChange={e => setWeeklyHours(Number(e.target.value))}
            disabled={submitting}
            className="w-full accent-[var(--accent-text)]"
          />
          <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
            <span>5h</span>
            <span>40h</span>
          </div>
        </div>

        {/* Tentative */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--text-heading)]">
            Première tentative&nbsp;?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setAttempt('first')}
              className={`px-3 py-3 rounded-lg text-sm border transition-colors ${
                attempt === 'first'
                  ? 'border-[var(--accent-text)] bg-[var(--accent-bg)] text-[var(--accent-text)] font-medium'
                  : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              Oui, première fois
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setAttempt('second')}
              className={`px-3 py-3 rounded-lg text-sm border transition-colors ${
                attempt === 'second'
                  ? 'border-[var(--accent-text)] bg-[var(--accent-bg)] text-[var(--accent-text)] font-medium'
                  : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              Non, nouvelle tentative
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity mt-8"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        {submitting ? 'Création…' : 'Commencer'}
      </button>
    </div>
  )
}
