/**
 * CRFPA Fiche d'arrêt Trainer page.
 * Decision picker (by chamber) → editor → results.
 */
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loader2, Menu, Trash2, X, FileText } from 'lucide-react'
import { LegalPageTabs } from '../components/legal/LegalPageTabs'
import { FicheArretEditor } from '../components/legal/FicheArretEditor'
import { FicheArretResults } from '../components/legal/FicheArretResults'
import { useFicheArretCoach } from '../hooks/useFicheArretCoach'
import { FICHE_CHAMBERS } from '../ai/prompts/ficheArretPrompts'

export default function FicheArretCoach() {
  const {
    phase,
    task,
    draft,
    submission,
    grading,
    history,
    error,
    sessionId,
    newDecision,
    saveDraft,
    submit,
    loadSession,
    removeSession,
    reset,
    cancel,
  } = useFicheArretCoach()

  const [chamberId, setChamberId] = useState<string>(FICHE_CHAMBERS[0].id)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Deep-link: ?session=ID auto-loads that session.
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
        <title>Fiche d'arrêt — Coach CRFPA | StudiesKit</title>
        <meta
          name="description"
          content="Entraînement à la fiche d'arrêt CRFPA sur des décisions réelles de la Cour de cassation."
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
            <FileText className="w-5 h-5 text-[var(--accent-text)]" />
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-heading)]">Coach Fiche d'arrêt</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Rédige la fiche d'une décision réelle de la Cour de cassation — correction sur 5 axes.
              </p>
            </div>
          </div>

          {phase === 'idle' && (
            <IdlePicker
              chamberId={chamberId}
              onChamberChange={setChamberId}
              onStart={() => newDecision(chamberId)}
              error={error}
            />
          )}

          {phase === 'generating' && (
            <CenteredSpinner label="Sélection d'une décision…" onCancel={cancel} />
          )}

          {(phase === 'editing' || phase === 'grading') && task && (
            <FicheArretEditor
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
            <FicheArretResults
              task={task}
              submission={submission}
              grading={grading}
              onRetry={reset}
              onNewDecision={reset}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface IdlePickerProps {
  chamberId: string
  onChamberChange: (id: string) => void
  onStart: () => void
  error?: string | null
}

function IdlePicker({ chamberId, onChamberChange, onStart, error }: IdlePickerProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[var(--text-heading)] mb-2">
            Choisis une chambre
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Une décision réelle sera tirée au hasard du corpus Cour de cassation.
          </p>
        </div>

        <div className="glass-card p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">
              Chambre
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FICHE_CHAMBERS.map(c => {
                const active = chamberId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChamberChange(c.id)}
                    className={`px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                      active
                        ? 'border-[var(--accent-text)] bg-[var(--accent-bg)] text-[var(--accent-text)] font-medium'
                        : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <div className="text-sm text-[var(--color-error)] ">{error}</div>}

          <button
            type="button"
            onClick={onStart}
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90"
          >
            Tirer une décision
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
  history: ReturnType<typeof useFicheArretCoach>['history']
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
          Nouvelle décision
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center mt-6 px-3">
            Pas encore de fiches. Tire ta première décision.
          </p>
        ) : (
          history.map(h => {
            const isActive = h.id === activeId
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
                    {h.task.decision.chamber}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-tight font-mono">
                    {h.task.decision.reference}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-1">
                    {status}
                    {h.grading && ` · ${h.grading.overall.score}/25`}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(h.id) }}
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
