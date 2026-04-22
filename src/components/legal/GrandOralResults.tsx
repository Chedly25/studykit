/**
 * Grand Oral grading results — 4-axis scores + overall + feedback.
 */
import { Award, ChevronDown, ChevronUp, ThumbsDown, ThumbsUp, AlertTriangle, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import type { GrandOralAxis, GrandOralGrading, GrandOralTask } from '../../ai/coaching/types'

const AXIS_LABELS: Record<GrandOralAxis, string> = {
  fondJuridique: 'Fond juridique',
  forme: 'Forme',
  reactivite: 'Réactivité',
  posture: 'Posture',
}

const AXIS_DESCRIPTIONS: Record<GrandOralAxis, string> = {
  fondJuridique: 'Exactitude des références, profondeur de l\'analyse, maîtrise des articles et arrêts',
  forme: 'Plan apparent, transitions, gestion du temps, éloquence',
  reactivite: 'Qualité des réponses, capacité à rebondir, tenue face aux relances',
  posture: 'Confiance, respect du cadre, maîtrise de la pression',
}

interface Props {
  task: GrandOralTask
  grading: GrandOralGrading
  onRestart: () => void
}

export function GrandOralResults({ task, grading, onRestart }: Props) {
  const [expandedAxis, setExpandedAxis] = useState<GrandOralAxis | null>(null)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <header className="space-y-1">
        <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Sujet</div>
        <h1 className="text-lg font-semibold text-[var(--text-heading)]">{task.sujet.text}</h1>
      </header>

      {/* Overall score */}
      <section className="rounded-lg border border-[var(--border-card)] bg-[var(--bg-main)] p-6">
        <div className="flex items-center gap-4">
          <div className={`flex items-center justify-center w-20 h-20 rounded-full border-4 ${grading.overall.admis ? 'border-green-500 text-green-500' : 'border-orange-500 text-orange-500'}`}>
            <div className="text-2xl font-bold">{grading.overall.score.toFixed(1)}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Award className={`w-4 h-4 ${grading.overall.admis ? 'text-green-500' : 'text-orange-500'}`} />
              {grading.overall.admis ? 'Admissible' : 'En-dessous de la moyenne'}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Moyenne des 4 axes sur 20</div>
          </div>
        </div>
      </section>

      {/* Axes */}
      <section className="space-y-2">
        {(Object.keys(AXIS_LABELS) as GrandOralAxis[]).map((axis) => {
          const axisScore = grading.axes[axis]
          const expanded = expandedAxis === axis
          return (
            <div key={axis} className="rounded-lg border border-[var(--border-card)] bg-[var(--bg-main)]">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setExpandedAxis(expanded ? null : axis)}
              >
                <div className="flex items-center gap-3">
                  <div className={`text-lg font-bold tabular-nums ${axisScore.score >= 14 ? 'text-green-500' : axisScore.score >= 10 ? 'text-[var(--text-heading)]' : 'text-orange-500'}`}>
                    {axisScore.score}/20
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{AXIS_LABELS[axis]}</div>
                    <div className="text-xs text-[var(--text-muted)]">{AXIS_DESCRIPTIONS[axis]}</div>
                  </div>
                </div>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {expanded && (
                <div className="px-4 pb-4 text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                  {axisScore.feedback}
                </div>
              )}
            </div>
          )
        })}
      </section>

      {/* Top strength + mistake */}
      <section className="grid md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <div className="flex items-center gap-2 text-green-600 text-xs uppercase tracking-wider mb-1">
            <ThumbsUp className="w-3 h-3" />
            Point fort
          </div>
          <p className="text-sm text-[var(--text-primary)]">{grading.overall.topStrength}</p>
        </div>
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
          <div className="flex items-center gap-2 text-orange-600 text-xs uppercase tracking-wider mb-1">
            <ThumbsDown className="w-3 h-3" />
            Principal écueil
          </div>
          <p className="text-sm text-[var(--text-primary)]">{grading.overall.topMistake}</p>
        </div>
      </section>

      {grading.overall.inventedReferences.length > 0 && (
        <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 text-red-600 text-xs uppercase tracking-wider mb-2">
            <AlertTriangle className="w-3 h-3" />
            Références à vérifier ({grading.overall.inventedReferences.length})
          </div>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
            {grading.overall.inventedReferences.map((ref, i) => (
              <li key={i}>{ref}</li>
            ))}
          </ul>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Ces références ont été citées dans votre exposé mais ne figurent pas dans
            le corpus de référence du sujet. Vérifiez-les avant de les réutiliser.
          </p>
        </section>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onRestart}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold hover:opacity-90"
        >
          <RotateCcw className="w-4 h-4" />
          Nouveau sujet
        </button>
      </div>
    </div>
  )
}
