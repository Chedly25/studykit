/**
 * Cas pratique setup screen — specialty picker (grouped by category) +
 * optional duration override + "Tirer un sujet" button.
 * Launches the pool-assembly → Opus generation → verification pipeline.
 */
import { useMemo, useState } from 'react'
import { Scale, Play, Loader2 } from 'lucide-react'
import { SPECIALTY_OPTIONS } from '../../ai/prompts/casPratiquePrompts'
import type { CasPratiqueSpecialty } from '../../ai/prompts/casPratiquePrompts'

interface Props {
  onStart: (specialty: CasPratiqueSpecialty, duration: number) => void
  busy?: boolean
  error?: string | null
}

function defaultDurationFor(specialty: CasPratiqueSpecialty): number {
  return specialty.startsWith('procedure-') ? 120 : 180
}

export function CasPratiqueSetup({ onStart, busy, error }: Props) {
  const [specialty, setSpecialty] = useState<CasPratiqueSpecialty>('obligations')
  const [duration, setDuration] = useState<number>(defaultDurationFor('obligations'))

  const grouped = useMemo(() => {
    return {
      obligations: SPECIALTY_OPTIONS.filter(o => o.category === 'obligations'),
      specialite: SPECIALTY_OPTIONS.filter(o => o.category === 'specialite'),
      procedure: SPECIALTY_OPTIONS.filter(o => o.category === 'procedure'),
    }
  }, [])

  const handleSpecialtyChange = (value: CasPratiqueSpecialty) => {
    setSpecialty(value)
    setDuration(defaultDurationFor(value))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
          <Scale className="w-5 h-5 text-[var(--accent-text)]" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
            Cas pratique
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Consultation juridique — rubrique sur 20.
          </p>
        </div>
      </div>

      <div className="glass-card p-5 space-y-5">
        <section className="space-y-2">
          <label className="text-sm font-semibold text-[var(--text-heading)]">
            Matière
          </label>
          <select
            value={specialty}
            onChange={e => handleSpecialtyChange(e.target.value as CasPratiqueSpecialty)}
            disabled={busy}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-text)] focus:outline-none disabled:opacity-60"
          >
            <optgroup label="Droit des obligations">
              {grouped.obligations.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="Spécialité">
              {grouped.specialite.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="Procédure">
              {grouped.procedure.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          </select>
        </section>

        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-sm font-semibold text-[var(--text-heading)]">
              Durée
            </label>
            <span className="text-xs text-[var(--text-muted)]">
              Défaut : {defaultDurationFor(specialty)} min (Arrêté 17 oct. 2016)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={60}
              max={240}
              step={15}
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              disabled={busy}
              className="flex-1"
            />
            <span className="text-sm font-mono tabular-nums text-[var(--text-body)] min-w-[4ch] text-right">
              {duration} min
            </span>
          </div>
        </section>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Le sujet est généré à partir d'un pool de références réelles (articles + jurisprudence) extrait de la base légale. Chaque citation de la correction modèle est vérifiée pour éviter les références fabriquées. Cela peut prendre 30&nbsp;s à 2&nbsp;min.
        </p>

        {error && (
          <div className="glass-card p-3 text-sm text-[var(--color-error)] border border-[var(--color-error-border)]">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => onStart(specialty, duration)}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {busy ? 'Génération du sujet…' : 'Tirer un sujet'}
        </button>
      </div>
    </div>
  )
}
