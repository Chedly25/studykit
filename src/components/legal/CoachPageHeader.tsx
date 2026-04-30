/**
 * Thin header bar for each CRFPA coach page.
 * Surfaces the coach name, a "Méthode" button (opens MethodPrimerModal), and
 * provides a slot for additional per-coach actions (Phase 3.2 will add a
 * "Voir un exemple corrigé" button here).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { HelpCircle, Play, Sparkles, X } from 'lucide-react'
import { COACH_PRIMERS, type CoachKind } from '../../data/coachPrimers'
import { COACH_EXAMPLES } from '../../data/coachExamples'
import { CoachExampleModal } from './CoachExampleModal'
import { COACH_DEMOS } from './demo/registry'

const DEMO_SEEN_STORAGE_KEY = (kind: CoachKind) => `coach_demo_seen_${kind}`

function readDemoSeen(kind: CoachKind): boolean {
  try {
    return localStorage.getItem(DEMO_SEEN_STORAGE_KEY(kind)) === '1'
  } catch {
    return false
  }
}

function writeDemoSeen(kind: CoachKind) {
  try {
    localStorage.setItem(DEMO_SEEN_STORAGE_KEY(kind), '1')
  } catch { /* noop */ }
}

interface CoachPageHeaderProps {
  kind: CoachKind
  /** Optional icon override; falls back to the icon passed by the page. */
  icon: React.ComponentType<{ className?: string }>
  /** Optional extra actions rendered before the example/method buttons. */
  rightSlot?: ReactNode
}

export function CoachPageHeader({ kind, icon: Icon, rightSlot }: CoachPageHeaderProps) {
  const primer = COACH_PRIMERS[kind]
  const example = COACH_EXAMPLES[kind]
  const DemoComponent = COACH_DEMOS[kind]
  const [primerOpen, setPrimerOpen] = useState(false)
  const [exampleOpen, setExampleOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoSeen, setDemoSeen] = useState(() => readDemoSeen(kind))

  const showFirstVisitBanner = !!DemoComponent && !demoSeen && !demoOpen

  const openDemo = useCallback(() => {
    writeDemoSeen(kind)
    setDemoSeen(true)
    setDemoOpen(true)
  }, [kind])

  const dismissBanner = useCallback(() => {
    writeDemoSeen(kind)
    setDemoSeen(true)
  }, [kind])

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
          <span className="text-sm font-semibold text-[var(--text-heading)] truncate">
            {primer.title}
          </span>
          <span className="hidden sm:inline text-xs text-[var(--text-muted)] truncate">
            · {primer.hook}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {rightSlot}
          {DemoComponent && (
            <button
              type="button"
              onClick={openDemo}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors"
              aria-label={`Découvrir — ${primer.title}`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Découvrir</span>
            </button>
          )}
          {example && (
            <button
              type="button"
              onClick={() => setExampleOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors"
              aria-label={`Voir un exemple corrigé — ${primer.title}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Exemple corrigé</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setPrimerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label={`Méthode — ${primer.title}`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Méthode</span>
          </button>
        </div>
      </div>

      {/* First-visit auto-prompt — appears once per coach until the user
          either opens the demo or dismisses the banner. localStorage-scoped. */}
      {showFirstVisitBanner && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-card)] bg-[var(--accent-bg)] animate-fade-in">
          <Play className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
          <span className="text-xs text-[var(--text-body)] flex-1 leading-snug">
            Premier passage&nbsp;? Une démo de 60 secondes avant de te lancer.
          </span>
          <button
            type="button"
            onClick={openDemo}
            className="text-xs font-semibold text-[var(--accent-text)] hover:underline shrink-0"
          >
            Voir la démo →
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] shrink-0"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {primerOpen && (
        <MethodPrimerModal kind={kind} onClose={() => setPrimerOpen(false)} />
      )}
      {exampleOpen && example && (
        <CoachExampleModal example={example} onClose={() => setExampleOpen(false)} />
      )}
      {demoOpen && DemoComponent && (
        <DemoComponent
          onClose={() => setDemoOpen(false)}
          onStartReal={() => setDemoOpen(false)}
        />
      )}
    </>
  )
}

interface MethodPrimerModalProps {
  kind: CoachKind
  onClose: () => void
}

function MethodPrimerModal({ kind, onClose }: MethodPrimerModalProps) {
  const primer = COACH_PRIMERS[kind]

  // Escape closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`primer-title-${kind}`}
    >
      <div
        className="relative max-w-lg w-full max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] shadow-xl animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-hover)] transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="p-6 pr-12">
          <div className="text-xs uppercase tracking-wider font-semibold text-[var(--accent-text)] mb-1">
            Méthode
          </div>
          <h2
            id={`primer-title-${kind}`}
            className="text-xl font-bold text-[var(--text-heading)]"
          >
            {primer.title}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{primer.hook}</p>
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] mt-3">
            Durée indicative · {primer.duration}
          </p>

          <div className="mt-5 space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-1.5">
                L'exercice
              </h3>
              <p className="text-[var(--text-body)]">{primer.what}</p>
            </section>
            <section>
              <h3 className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-1.5">
                Pourquoi ça compte
              </h3>
              <p className="text-[var(--text-body)]">{primer.why}</p>
            </section>
            <section>
              <h3 className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-1.5">
                Ce que le correcteur attend
              </h3>
              <ul className="space-y-1.5 text-[var(--text-body)]">
                {primer.axes.map((axis, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[var(--accent-text)] mt-0.5 shrink-0">·</span>
                    <span>{axis}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
