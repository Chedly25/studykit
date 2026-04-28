/**
 * CPGE-specific onboarding form — 3 structured questions.
 * No LLM, no chat. Creates the profile and (for now) redirects to /dashboard.
 * Phase B will add a dedicated CPGE Atelier.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, GraduationCap } from 'lucide-react'
import { useExamProfile } from '../../hooks/useExamProfile'

interface Props {
  onBack: () => void
}

const CONCOURS_OPTIONS = [
  { id: 'mines-ponts', label: 'Mines-Ponts' },
  { id: 'centrale-supelec', label: 'Centrale-Supélec' },
  { id: 'x-ens', label: 'X-ENS' },
  { id: 'ccinp', label: 'CCINP' },
  { id: 'e3a', label: 'E3A' },
  { id: 'autre', label: 'Autre' },
] as const

export function CPGEOnboardingForm({ onBack }: Props) {
  const navigate = useNavigate()
  const { createProfile } = useExamProfile()

  const [concoursSelected, setConcoursSelected] = useState<Set<string>>(new Set())
  const [examDate, setExamDate] = useState<string>('')
  const [noDeadline, setNoDeadline] = useState(false)
  const [weeklyHours, setWeeklyHours] = useState<number>(20)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    !submitting &&
    concoursSelected.size > 0 &&
    (noDeadline || examDate.length > 0)

  const toggleConcours = (id: string) => {
    setConcoursSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const selectedLabels = CONCOURS_OPTIONS
        .filter(o => concoursSelected.has(o.id))
        .map(o => o.label)
      const name = `Prépa CPGE — ${selectedLabels.join(', ')}`
      const dateValue = noDeadline ? '' : examDate
      await createProfile(name, 'university-course', dateValue, weeklyHours, 'study', 'cpge')
      navigate('/dashboard', { replace: true })
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
          <GraduationCap className="w-6 h-6 text-[var(--accent-text)]" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
            Prépa CPGE
          </h1>
          <p className="text-sm text-[var(--text-muted)]">Trois questions et on démarre.</p>
        </div>
      </div>

      <div className="space-y-6 flex-1">
        {/* Concours visés */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--text-heading)]">
            Concours visés
          </label>
          <p className="text-xs text-[var(--text-muted)]">Tu peux en choisir plusieurs.</p>
          <div className="grid grid-cols-2 gap-2">
            {CONCOURS_OPTIONS.map(opt => {
              const active = concoursSelected.has(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => toggleConcours(opt.id)}
                  className={`px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                    active
                      ? 'border-[var(--accent-text)] bg-[var(--accent-bg)] text-[var(--accent-text)] font-medium'
                      : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

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
            max={60}
            step={1}
            value={weeklyHours}
            onChange={e => setWeeklyHours(Number(e.target.value))}
            disabled={submitting}
            className="w-full accent-[var(--accent-text)]"
          />
          <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
            <span>5h</span>
            <span>60h</span>
          </div>
        </div>

        {error && (
          <div className="text-sm text-[var(--color-error)] ">{error}</div>
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
