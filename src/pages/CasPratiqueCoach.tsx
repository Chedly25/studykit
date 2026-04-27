/**
 * CRFPA Cas pratique Coach page.
 * Specialty picker → grounded scenario generation (Opus + verify) → editor → rubric.
 */
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loader2, Menu, Trash2, X, Scale } from 'lucide-react'
import { LegalPageTabs } from '../components/legal/LegalPageTabs'
import { CasPratiqueSetup } from '../components/legal/CasPratiqueSetup'
import { CasPratiqueEditor } from '../components/legal/CasPratiqueEditor'
import { CasPratiqueResults } from '../components/legal/CasPratiqueResults'
import { useCasPratiqueCoach } from '../hooks/useCasPratiqueCoach'
import { SPECIALTY_OPTIONS } from '../ai/prompts/casPratiquePrompts'

export default function CasPratiqueCoach() {
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
  } = useCasPratiqueCoach()

  const [historyOpen, setHistoryOpen] = useState(false)

  const [searchParams, setSearchParams] = useSearchParams()
  const loadedRef = useRef<string | null>(null)
  useEffect(() => {
    const id = searchParams.get('session')
    if (!id || loadedRef.current === id) return
    loadedRef.current = id
    loadSession(id).then(() => {
      setSearchParams({}, { replace: true })
    })
  }, [searchParams, loadSession, setSearchParams])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <Helmet>
        <title>Cas pratique — Coach CRFPA | StudiesKit</title>
        <meta
          name="description"
          content="Entraînement au cas pratique CRFPA : consultation juridique sur 20, sujets générés à partir d'un pool de références réelles vérifiées."
        />
      </Helmet>

      <LegalPageTabs />

      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border-card)] shrink-0">
          <HistoryList
            history={history}
            activeId={sessionId}
            onSelect={loadSession}
            onDelete={removeSession}
            onNew={reset}
          />
        </aside>

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
                onSelect={id => { loadSession(id); setHistoryOpen(false) }}
                onDelete={removeSession}
                onNew={() => { reset(); setHistoryOpen(false) }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-card)]">
            <button
              onClick={() => setHistoryOpen(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
              aria-label="Historique"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Scale className="w-5 h-5 text-[var(--accent-text)]" />
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-heading)]">Coach Cas pratique</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Consultation juridique — correction sur 6 axes, total sur 20.
              </p>
            </div>
          </div>

          {phase === 'idle' && (
            <CasPratiqueSetup
              onStart={newScenario}
              error={error}
            />
          )}

          {phase === 'generating' && (
            <CenteredSpinner
              label="Génération et vérification du sujet — 30 s à 2 min…"
              onCancel={cancel}
            />
          )}

          {(phase === 'editing' || phase === 'grading') && task && (
            <CasPratiqueEditor
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
            <CasPratiqueResults
              task={task}
              submission={submission}
              grading={grading}
              onRestart={reset}
            />
          )}
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
        <p className="text-sm text-[var(--text-muted)] text-center max-w-sm">{label}</p>
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
  history: ReturnType<typeof useCasPratiqueCoach>['history']
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
          Nouveau cas pratique
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center mt-6 px-3">
            Pas encore de cas pratique. Tire ton premier sujet.
          </p>
        ) : (
          history.map(h => {
            const isActive = h.id === activeId
            const status = h.grading ? 'Corrigé' : h.submission ? 'Soumis' : 'En cours'
            const label = SPECIALTY_OPTIONS.find(o => o.value === h.task.specialty)?.label ?? h.task.specialty
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
                    {label}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-tight">
                    {h.task.scenario.slice(0, 80)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-1">
                    {status}
                    {h.grading && ` · ${h.grading.overall.score}/20`}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(h.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-rose-500 transition-opacity"
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
