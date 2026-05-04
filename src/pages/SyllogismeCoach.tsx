/**
 * CRFPA Syllogisme Coach — the page composes:
 *  - state-dependent body (idle picker / editor / grading spinner / results)
 *  - history sidebar (previously generated scenarios)
 */
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loader2, Menu, Trash2, X, PenSquare } from 'lucide-react'
import { CoachPageHeader } from '../components/legal/CoachPageHeader'
import { SyllogismeEditor } from '../components/legal/SyllogismeEditor'
import { SyllogismeResults } from '../components/legal/SyllogismeResults'
import { useSyllogismeCoach } from '../hooks/useSyllogismeCoach'
import { SYLLOGISME_THEMES } from '../ai/prompts/syllogismePrompts'
import type { SyllogismeDifficulty } from '../ai/coaching/types'
import { useReportExerciseToCompanion } from '../hooks/useReportExerciseToCompanion'

const DIFFICULTIES: Array<{ id: SyllogismeDifficulty; label: string; hint: string }> = [
  { id: 'beginner', label: 'Débutant', hint: '1 article, qualification claire' },
  { id: 'intermediate', label: 'Intermédiaire', hint: 'Un faux-ami factuel à écarter' },
  { id: 'advanced', label: 'Avancé', hint: 'Qualification ambiguë, faits discutables' },
]

export default function SyllogismeCoach() {
  const {
    phase,
    task,
    draft,
    submission,
    grading,
    history,
    error,
    sessionId,
    newScenario,
    saveDraft,
    submit,
    loadSession,
    removeSession,
    reset,
    cancel,
  } = useSyllogismeCoach()

  const [themeId, setThemeId] = useState<string>(SYLLOGISME_THEMES[0].id)
  const [difficulty, setDifficulty] = useState<SyllogismeDifficulty>('beginner')
  const [historyOpen, setHistoryOpen] = useState(false)

  // Report exercise context to the companion widget
  useReportExerciseToCompanion('syllogisme', '/legal/syllogisme', task)

  // Deep-link: ?session=ID auto-loads that session on mount (once per ID).
  const [searchParams, setSearchParams] = useSearchParams()
  const loadedRef = useRef<string | null>(null)
  useEffect(() => {
    const id = searchParams.get('session')
    if (!id || loadedRef.current === id) return
    loadedRef.current = id
    loadSession(id).then(() => {
      // Remove ?session= from the URL so back/forward doesn't replay the load
      setSearchParams({}, { replace: true })
    })
  }, [searchParams, loadSession, setSearchParams])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <Helmet>
        <title>Syllogisme — Coach CRFPA | StudiesKit</title>
        <meta
          name="description"
          content="Entraînement au syllogisme juridique CRFPA : majeure, mineure, conclusion — avec correction méthodologique."
        />
      </Helmet>
      <CoachPageHeader kind="syllogisme" icon={PenSquare} />

      <div className="flex flex-1 min-h-0">
        {/* History sidebar (desktop) */}
        <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border-card)] shrink-0">
          <HistoryList
            history={history}
            activeId={sessionId}
            onSelect={loadSession}
            onDelete={removeSession}
            onNew={reset}
          />
        </aside>

        {/* History drawer (mobile) */}
        {historyOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div className="absolute inset-0 bg-black/40" onClick={() => setHistoryOpen(false)} />
            <div className="relative w-72 bg-[var(--bg-main)] h-full flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-[var(--border-card)]">
                <span className="text-sm font-semibold">Historique</span>
                <button onClick={() => setHistoryOpen(false)} className="p-1.5 rounded hover:bg-[var(--bg-hover)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <HistoryList
                history={history}
                activeId={sessionId}
                onSelect={id => {
                  loadSession(id)
                  setHistoryOpen(false)
                }}
                onDelete={removeSession}
                onNew={() => {
                  reset()
                  setHistoryOpen(false)
                }}
              />
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Header row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-card)]">
            <button
              onClick={() => setHistoryOpen(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
              aria-label="Historique"
            >
              <Menu className="w-5 h-5" />
            </button>
            <PenSquare className="w-5 h-5 text-[var(--accent-text)]" />
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-heading)]">Coach Syllogisme</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Rédige ta majeure, ta mineure et ta conclusion — obtiens une correction méthodologique.
              </p>
            </div>
          </div>

          {/* Body */}
          {phase === 'idle' && (
            <IdlePicker
              themeId={themeId}
              difficulty={difficulty}
              onThemeChange={setThemeId}
              onDifficultyChange={setDifficulty}
              onStart={() => newScenario(themeId, difficulty)}
              error={error}
            />
          )}

          {phase === 'generating' && (
            <CenteredSpinner label="Génération du scénario…" onCancel={cancel} />
          )}

          {(phase === 'editing' || phase === 'grading') && task && (
            <SyllogismeEditor
              task={task}
              draft={draft}
              onChange={saveDraft}
              onSubmit={submit}
              onCancel={cancel}
              busy={phase === 'grading'}
              error={error}
            />
          )}

          {phase === 'graded' && task && submission && grading && (
            <SyllogismeResults
              task={task}
              submission={submission}
              grading={grading}
              onRetry={() => {
                // keep the scenario loaded; clear grading so student can re-edit
                reset()
              }}
              onNewScenario={() => reset()}
            />
          )}
        </div>
      </div>

    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────

interface IdlePickerProps {
  themeId: string
  difficulty: SyllogismeDifficulty
  onThemeChange: (id: string) => void
  onDifficultyChange: (d: SyllogismeDifficulty) => void
  onStart: () => void
  error?: string | null
}

function IdlePicker({ themeId, difficulty, onThemeChange, onDifficultyChange, onStart, error }: IdlePickerProps) {
  // Group themes by domain for the dropdown
  const byDomain = SYLLOGISME_THEMES.reduce<Record<string, typeof SYLLOGISME_THEMES>>((acc, t) => {
    (acc[t.domain] ??= []).push(t)
    return acc
  }, {})
  const DOMAIN_LABELS: Record<string, string> = {
    civil: 'Droit civil',
    social: 'Droit social',
    penal: 'Droit pénal',
    administratif: 'Droit administratif',
    commercial: 'Droit commercial',
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[var(--text-heading)] mb-2">
            Choisis un thème et un niveau
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Le scénario sera généré à partir d'articles réels du droit français.
          </p>
        </div>

        <div className="glass-card p-4 space-y-4">
          {/* Theme */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">
              Thème
            </label>
            <select
              value={themeId}
              onChange={e => onThemeChange(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-text)] focus:outline-none"
            >
              {Object.entries(byDomain).map(([domain, themes]) => (
                <optgroup key={domain} label={DOMAIN_LABELS[domain] ?? domain}>
                  {themes.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">
              Niveau
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onDifficultyChange(d.id)}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors text-left ${
                    difficulty === d.id
                      ? 'border-[var(--accent-text)] bg-[var(--accent-bg)] text-[var(--accent-text)]'
                      : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="font-medium">{d.label}</div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-tight">{d.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm text-[var(--color-error)] ">{error}</div>
          )}

          <button
            type="button"
            onClick={onStart}
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90"
          >
            Générer un scénario
          </button>
        </div>
      </div>
    </div>
  )
}

function CenteredSpinner({ label, onCancel }: { label: string; onCancel?: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-text)]" />
        <p className="text-sm text-[var(--text-muted)]">{label}</p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  )
}

interface HistoryListProps {
  history: ReturnType<typeof useSyllogismeCoach>['history']
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
}

function HistoryList({ history, activeId, onSelect, onDelete, onNew }: HistoryListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[var(--border-card)]">
        <button
          onClick={onNew}
          className="w-full px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90"
        >
          Nouveau scénario
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center mt-6 px-3">
            Pas encore d'entraînements. Génère ton premier scénario.
          </p>
        ) : (
          history.map(h => {
            const isActive = h.id === activeId
            const preview = h.task.scenario.slice(0, 60)
            const status = h.grading ? 'Corrigé' : h.submission ? 'Soumis' : 'En cours'
            return (
              <div
                key={h.id}
                className={`group flex items-start gap-2 p-2 rounded-lg cursor-pointer ${
                  isActive ? 'bg-[var(--accent-bg)]' : 'hover:bg-[var(--bg-hover)]'
                }`}
                onClick={() => onSelect(h.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[var(--text-heading)] truncate">
                    {h.task.theme}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-tight">
                    {preview}…
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-1">
                    {status}
                    {h.grading && ` · ${h.grading.overall.score}/30`}
                  </div>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    onDelete(h.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--color-error)] transition-opacity"
                  aria-label="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
