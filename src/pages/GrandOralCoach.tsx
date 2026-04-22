/**
 * CRFPA Grand Oral Trainer page.
 * State machine: idle → grounding → ready (brief) → connecting → live → grading → graded.
 * Uses seed corpus (56 sujets). Picks randomly per filters; grounds via Claude+RAG.
 */
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loader2, Menu, Mic2, Trash2, X } from 'lucide-react'
import { LegalPageTabs } from '../components/legal/LegalPageTabs'
import { GrandOralBrief } from '../components/legal/GrandOralBrief'
import { GrandOralSessionLive } from '../components/legal/GrandOralSessionLive'
import { GrandOralResults } from '../components/legal/GrandOralResults'
import { useGrandOralCoach } from '../hooks/useGrandOralCoach'
import { listAvailableThemes } from '../ai/coaching/grandOralCoach'
import type { GrandOralSujetType } from '../ai/prompts/grandOralPrompts'
import type { GrandOralSessionView } from '../ai/coaching/grandOralStore'

const TYPE_OPTIONS: Array<{ value: GrandOralSujetType | ''; label: string }> = [
  { value: '', label: 'Tous les types' },
  { value: 'question', label: 'Question ouverte' },
  { value: 'case', label: 'Commentaire d\'arrêt' },
  { value: 'article', label: 'Commentaire d\'article' },
]

export default function GrandOralCoach() {
  const {
    phase,
    task,
    sessionToken,
    sessionId,
    grading,
    history,
    error,
    startNew,
    connectSession,
    toolHandler,
    submitAndGrade,
    loadSession,
    removeSession,
    reset,
  } = useGrandOralCoach()

  const [typeFilter, setTypeFilter] = useState<GrandOralSujetType | ''>('')
  const [themeFilter, setThemeFilter] = useState<string>('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const themes = listAvailableThemes()

  // Load session from URL param once
  const [searchParams, setSearchParams] = useSearchParams()
  const loadedRef = useRef<string | null>(null)
  useEffect(() => {
    const id = searchParams.get('session')
    if (!id || loadedRef.current === id) return
    loadedRef.current = id
    void loadSession(id).then(() => setSearchParams({}, { replace: true }))
  }, [searchParams, loadSession, setSearchParams])

  const handleStart = () => {
    void startNew({
      type: typeFilter || undefined,
      theme: themeFilter || undefined,
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <Helmet>
        <title>Grand Oral — Coach CRFPA | StudiesKit</title>
        <meta
          name="description"
          content="Entraînement au Grand Oral CRFPA : simulation vocale avec un jury IA, 15 min d'exposé + 30 min de questions, correction sur 4 axes."
        />
      </Helmet>

      <LegalPageTabs />

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
                onSelect={(id) => { void loadSession(id); setHistoryOpen(false) }}
                onDelete={removeSession}
                onNew={() => { reset(); setHistoryOpen(false) }}
              />
            </div>
          </div>
        )}

        {/* Main pane */}
        <main className="flex-1 min-h-0 flex flex-col">
          <div className="md:hidden flex items-center p-2 border-b border-[var(--border-card)]">
            <button onClick={() => setHistoryOpen(true)} className="p-2 rounded hover:bg-[var(--bg-hover)]">
              <Menu className="w-5 h-5" />
            </button>
            <span className="ml-2 text-sm font-semibold">Grand Oral</span>
          </div>

          {error && (
            <div className="mx-4 mt-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm p-3">
              {error}
            </div>
          )}

          {/* Phase-specific views */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {phase === 'idle' && (
              <IdleView
                themes={themes}
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilter}
                themeFilter={themeFilter}
                setThemeFilter={setThemeFilter}
                onStart={handleStart}
              />
            )}

            {phase === 'grounding' && <LoadingView label="Préparation de votre sujet…" />}

            {phase === 'ready' && task && (
              <GrandOralBrief
                task={task}
                onStart={() => void connectSession()}
                onCancel={reset}
              />
            )}

            {phase === 'connecting' && <LoadingView label="Connexion au jury…" />}

            {phase === 'live' && task && sessionToken && (
              <div className="h-full">
                <GrandOralSessionLive
                  task={task}
                  clientSecret={sessionToken.clientSecret}
                  model={sessionToken.model}
                  toolHandler={toolHandler}
                  onFinish={({ transcript, metrics }) => {
                    void submitAndGrade(transcript, {
                      durationSec: metrics.durationSec,
                      interruptionCount: metrics.interruptionCount,
                      avgLatencySec: metrics.avgLatencySec,
                      juryQuestions: metrics.juryQuestions,
                    })
                  }}
                  onError={() => { /* error already surfaced via hook state */ }}
                />
              </div>
            )}

            {phase === 'grading' && <LoadingView label="Correction en cours…" />}

            {phase === 'graded' && task && grading && (
              <GrandOralResults task={task} grading={grading} onRestart={reset} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────

function LoadingView({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-3 text-[var(--text-muted)]">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  )
}

interface IdleProps {
  themes: string[]
  typeFilter: GrandOralSujetType | ''
  setTypeFilter: (v: GrandOralSujetType | '') => void
  themeFilter: string
  setThemeFilter: (v: string) => void
  onStart: () => void
}

function IdleView({ themes, typeFilter, setTypeFilter, themeFilter, setThemeFilter, onStart }: IdleProps) {
  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-[var(--accent-bg)]/10 text-[var(--accent-bg)]">
          <Mic2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-heading)]">Grand Oral</h1>
          <p className="text-sm text-[var(--text-muted)]">Simulation vocale avec jury IA — 45 min</p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-card)] bg-[var(--bg-main)] p-4 text-sm space-y-2">
        <p>Déroulement identique au jour J :</p>
        <ul className="list-disc pl-5 space-y-1 text-[var(--text-muted)]">
          <li>Tirage d'un sujet (question, arrêt ou article)</li>
          <li>Préparation libre (consultation du plan attendu + références)</li>
          <li>15 min d'exposé — le jury écoute en silence</li>
          <li>30 min de questions — le jury interrompt, relance, cite</li>
          <li>Correction sur 4 axes : fond, forme, réactivité, posture</li>
        </ul>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Type de sujet</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as GrandOralSujetType | '')}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] text-[var(--text-primary)]"
          >
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Thème (optionnel)</span>
          <select
            value={themeFilter}
            onChange={(e) => setThemeFilter(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] text-[var(--text-primary)]"
          >
            <option value="">Tous les thèmes</option>
            {themes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="w-full px-5 py-3 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold hover:opacity-90"
      >
        Tirer un sujet
      </button>

      <p className="text-xs text-[var(--text-muted)]">
        Fonctionnalité Pro — 2 sessions/mois. La connexion audio se fait directement
        entre votre navigateur et OpenAI ; aucune voix ne transite par nos serveurs.
      </p>
    </div>
  )
}

interface HistoryListProps {
  history: GrandOralSessionView[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
}

function HistoryList({ history, activeId, onSelect, onDelete, onNew }: HistoryListProps) {
  return (
    <>
      <div className="p-3 border-b border-[var(--border-card)]">
        <button
          onClick={onNew}
          className="w-full px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-semibold hover:opacity-90"
        >
          + Nouveau sujet
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] p-4 text-center">Aucune session pour l'instant.</p>
        ) : (
          history.map(h => {
            const active = h.id === activeId
            const score = h.grading?.overall.score
            return (
              <div
                key={h.id}
                className={`group flex items-start gap-2 rounded-lg p-2 cursor-pointer ${active ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'}`}
                onClick={() => onSelect(h.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[var(--text-heading)] line-clamp-2">{h.task.sujet.text}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {new Date(h.createdAt).toLocaleDateString('fr-FR')}
                    {score !== undefined && <> · <span className={score >= 10 ? 'text-green-500' : 'text-orange-500'}>{score.toFixed(1)}/20</span></>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void onDelete(h.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-500"
                  aria-label="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
