/**
 * CRFPA Note de synthèse Trainer page.
 * Dossier generation (background) → split-pane editor (dossier + writing) → graded results.
 */
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loader2, Menu, Trash2, X, FileCheck } from 'lucide-react'
import { CoachPageHeader } from '../components/legal/CoachPageHeader'
import { NoteSyntheseEditor } from '../components/legal/NoteSyntheseEditor'
import { NoteSyntheseResults } from '../components/legal/NoteSyntheseResults'
import { useNoteSyntheseCoach } from '../hooks/useNoteSyntheseCoach'
import type { NoteSyntheseSessionView } from '../ai/coaching/noteSyntheseStore'

export default function NoteSyntheseCoach() {
  const {
    phase,
    task,
    draftText,
    submission,
    grading,
    history,
    error,
    sessionId,
    generationProgress,
    newDossier,
    saveDraft,
    submit,
    loadSession,
    removeSession,
    reset,
    cancel,
  } = useNoteSyntheseCoach()

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
        <title>Note de synthèse — Coach CRFPA | StudiesKit</title>
        <meta
          name="description"
          content="Entraînement à la note de synthèse CRFPA : dossier de documents réels, rédaction et correction sur 8 axes."
        />
      </Helmet>
      <CoachPageHeader kind="note-synthese" icon={FileCheck} />

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
            <FileCheck className="w-5 h-5 text-[var(--accent-text)]" />
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-heading)]">Coach Note de synthèse</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Dossier de documents réels — rédige ta synthèse, correction sur 8 axes /20.
              </p>
            </div>
          </div>

          {phase === 'idle' && (
            <IdlePicker onStart={() => newDossier()} error={error} />
          )}

          {phase === 'generating' && (
            <GenerationProgress
              progress={generationProgress}
              onCancel={cancel}
            />
          )}

          {(phase === 'editing' || phase === 'grading') && task && (
            <NoteSyntheseEditor
              task={task}
              draftText={draftText}
              onChange={saveDraft}
              onSubmit={submit}
              onCancel={cancel}
              busy={phase === 'grading'}
              error={error}
            />
          )}

          {phase === 'graded' && task && submission && grading && (
            <NoteSyntheseResults
              task={task}
              submission={submission}
              grading={grading}
              onRetry={reset}
              onNewDossier={reset}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function IdlePicker({ onStart, error }: { onStart: () => void; error?: string | null }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[var(--text-heading)] mb-2">
            Note de synthèse
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Un dossier de 12-15 documents réels sera constitué à partir de sources juridiques publiques
            (Cour de cassation, Legifrance, doctrine). Rédige ta synthèse en 4 pages.
          </p>
        </div>

        <div className="glass-card p-4 space-y-4">
          {error && <div className="text-sm text-[var(--color-error)] ">{error}</div>}

          <button
            type="button"
            onClick={onStart}
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90"
          >
            Générer un nouveau dossier
          </button>

          <p className="text-[11px] text-[var(--text-muted)] text-center">
            La génération prend 2 à 5 minutes — tu peux naviguer ailleurs et revenir.
          </p>
        </div>
      </div>
    </div>
  )
}

function GenerationProgress({
  progress,
  onCancel,
}: {
  progress: { currentStepName: string; completedSteps: number; totalSteps: number; progress: number } | null
  onCancel: () => void
}) {
  const pct = progress ? Math.round(progress.progress * 100) : 0

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-text)]" />
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--text-heading)]">
              Constitution du dossier...
            </p>
            {progress && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {progress.currentStepName || `Étape ${progress.completedSteps + 1}/${progress.totalSteps}`}
              </p>
            )}
          </div>
        </div>

        {progress && (
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-[var(--bg-input)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent-text)] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--text-muted)] text-center">
              {progress.completedSteps}/{progress.totalSteps} étapes — {pct}%
            </p>
          </div>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

interface HistoryListProps {
  history: NoteSyntheseSessionView[]
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
          Nouveau dossier
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center mt-6 px-3">
            Pas encore de synthèses. Génère ton premier dossier.
          </p>
        ) : (
          history.map(h => {
            const isActive = h.id === activeId
            const status = h.generating
              ? 'Génération...'
              : h.grading
                ? 'Corrigé'
                : h.submission
                  ? 'Soumis'
                  : 'En cours'
            const title = h.task?.dossierTitle ?? 'Dossier en cours...'
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
                    {title}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-1">
                    {status}
                    {h.grading && ` · ${h.grading.overall.score}/20`}
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
