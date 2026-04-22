/**
 * Pre-session view for the Grand Oral coach.
 * Shows the tiré sujet + the full grounded task (problématique, plan attendu,
 * key points, subsidiary questions, resolved refs) — simulating the "1 hour
 * of preparation" phase of the real exam. Student clicks "Commencer" when
 * ready to go live.
 */
import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, Play } from 'lucide-react'
import type { GrandOralTask } from '../../ai/coaching/types'

interface Props {
  task: GrandOralTask
  onStart: () => void
  onCancel: () => void
  connecting?: boolean
}

export function GrandOralBrief({ task, onStart, onCancel, connecting = false }: Props) {
  const [showPlan, setShowPlan] = useState(true)
  const [showRefs, setShowRefs] = useState(false)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Sujet tiré</div>
        <h1 className="text-2xl font-semibold text-[var(--text-heading)]">{task.sujet.text}</h1>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
          <span className="px-2 py-0.5 rounded bg-[var(--bg-hover)]">{labelForType(task.sujet.type)}</span>
          <span className="px-2 py-0.5 rounded bg-[var(--bg-hover)]">{task.sujet.theme}</span>
          {task.sujet.iej && <span className="px-2 py-0.5 rounded bg-[var(--bg-hover)]">IEJ {task.sujet.iej}</span>}
          {task.sujet.year && <span className="px-2 py-0.5 rounded bg-[var(--bg-hover)]">{task.sujet.year}</span>}
        </div>
      </header>

      <section className="rounded-lg border border-[var(--border-card)] bg-[var(--bg-main)] p-4">
        <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Problématique</div>
        <p className="text-[var(--text-primary)]">{task.problematique}</p>
      </section>

      <section className="rounded-lg border border-[var(--border-card)] bg-[var(--bg-main)]">
        <button
          type="button"
          className="w-full flex items-center justify-between p-4 text-left"
          onClick={() => setShowPlan(v => !v)}
        >
          <span className="text-sm font-semibold text-[var(--text-heading)]">Plan attendu (votre brouillon)</span>
          {showPlan ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showPlan && (
          <div className="px-4 pb-4 space-y-3 text-sm">
            <div>
              <div className="font-semibold">I. {task.expectedPlan.I}</div>
              <div className="pl-4 text-[var(--text-muted)]">A. {task.expectedPlan.IA}</div>
              <div className="pl-4 text-[var(--text-muted)]">B. {task.expectedPlan.IB}</div>
            </div>
            <div>
              <div className="font-semibold">II. {task.expectedPlan.II}</div>
              <div className="pl-4 text-[var(--text-muted)]">A. {task.expectedPlan.IIA}</div>
              <div className="pl-4 text-[var(--text-muted)]">B. {task.expectedPlan.IIB}</div>
            </div>
            {task.keyPoints.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--border-card)]">
                <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Arguments clés</div>
                <ul className="list-disc pl-5 space-y-1">
                  {task.keyPoints.map((kp, i) => (
                    <li key={i}>
                      {kp.point}
                      {kp.refIndex >= 0 && (
                        <span className="ml-1 text-xs text-[var(--text-muted)]">
                          [ref {kp.refIndex + 1}]
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border-card)] bg-[var(--bg-main)]">
        <button
          type="button"
          className="w-full flex items-center justify-between p-4 text-left"
          onClick={() => setShowRefs(v => !v)}
        >
          <span className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Références disponibles ({task.resolvedRefs.length})
          </span>
          {showRefs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showRefs && (
          <div className="px-4 pb-4 space-y-3 text-sm">
            {task.resolvedRefs.map((ref, i) => (
              <div key={i} className="pl-3 border-l-2 border-[var(--border-card)]">
                <div className="text-xs text-[var(--text-muted)]">[{i + 1}] {ref.hint}</div>
                <div className="font-mono text-xs mt-1 text-[var(--text-primary)]">{ref.source}</div>
                <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-3">{ref.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onStart}
          disabled={connecting}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          {connecting ? 'Connexion au jury…' : 'Commencer l\'épreuve'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={connecting}
          className="px-5 py-3 rounded-lg border border-[var(--border-card)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
        >
          Annuler
        </button>
      </div>

      <div className="text-xs text-[var(--text-muted)] pt-2">
        Dès que vous cliquez « Commencer », l'horloge démarre. Vous avez 15 min
        d'exposé, puis 30 min de questions. Le jury peut interrompre à tout moment.
      </div>
    </div>
  )
}

function labelForType(type: string): string {
  if (type === 'question') return 'Question ouverte'
  if (type === 'case') return 'Commentaire d\'arrêt'
  if (type === 'article') return 'Commentaire d\'article'
  return type
}
