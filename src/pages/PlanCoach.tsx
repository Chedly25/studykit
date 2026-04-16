/**
 * CRFPA Plan Détaillé Coach page — composes:
 *  - shared tab bar (LegalPageTabs)
 *  - state-dependent body (idle picker / editor / grading spinner / results)
 *  - history sidebar with previously drafted plans
 */
import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Loader2, Menu, Trash2, X, ListTree } from 'lucide-react'
import { LegalPageTabs } from '../components/legal/LegalPageTabs'
import { PlanEditor } from '../components/legal/PlanEditor'
import { PlanResults } from '../components/legal/PlanResults'
import { usePlanCoach } from '../hooks/usePlanCoach'
import { PLAN_THEMES } from '../ai/prompts/planPrompts'

export default function PlanCoach() {
  const {
    phase,
    task,
    draft,
    submission,
    grading,
    history,
    error,
    sessionId,
    newQuestion,
    saveDraft,
    submit,
    loadSession,
    removeSession,
    reset,
    cancel,
  } = usePlanCoach()

  const [themeId, setThemeId] = useState<string>(PLAN_THEMES[0].id)
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <Helmet>
        <title>Plan détaillé — Coach CRFPA | StudiesKit</title>
        <meta
          name="description"
          content="Entraînement au plan détaillé CRFPA : problématique, I/II, sous-parties — correction méthodologique sur 6 axes."
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

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-card)]">
            <button
              onClick={() => setHistoryOpen(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
              aria-label="Historique"
            >
              <Menu className="w-5 h-5" />
            </button>
            <ListTree className="w-5 h-5 text-[var(--accent-text)]" />
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-heading)]">Coach Plan détaillé</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Construis un plan problématisé en deux parties — reçois une correction sur 6 axes.
              </p>
            </div>
          </div>

          {phase === 'idle' && (
            <IdlePicker
              themeId={themeId}
              onThemeChange={setThemeId}
              onStart={() => newQuestion(themeId)}
              error={error}
            />
          )}

          {phase === 'generating' && (
            <CenteredSpinner label="Génération du sujet…" onCancel={cancel} />
          )}

          {(phase === 'editing' || phase === 'grading') && task && (
            <PlanEditor
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
            <PlanResults
              task={task}
              submission={submission}
              grading={grading}
              onRetry={reset}
              onNewQuestion={reset}
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
  onThemeChange: (id: string) => void
  onStart: () => void
  error?: string | null
}

const DOMAIN_LABELS: Record<string, string> = {
  civil: 'Droit civil',
  social: 'Droit social',
  penal: 'Droit pénal',
  administratif: 'Droit administratif',
  constitutionnel: 'Droit constitutionnel',
  europeen: 'Droit européen',
}

function IdlePicker({ themeId, onThemeChange, onStart, error }: IdlePickerProps) {
  const byDomain = PLAN_THEMES.reduce<Record<string, typeof PLAN_THEMES>>((acc, t) => {
    (acc[t.domain] ??= []).push(t)
    return acc
  }, {})

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[var(--text-heading)] mb-2">
            Choisis un thème de dissertation
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Le sujet sera ancré dans des articles réels du droit français. Le plan modèle reste caché jusqu'à ta correction.
          </p>
        </div>

        <div className="glass-card p-4 space-y-4">
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

          {error && (
            <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>
          )}

          <button
            type="button"
            onClick={onStart}
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90"
          >
            Générer un sujet
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
  history: ReturnType<typeof usePlanCoach>['history']
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
          Nouveau sujet
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center mt-6 px-3">
            Pas encore de plans. Génère ton premier sujet.
          </p>
        ) : (
          history.map(h => {
            const isActive = h.id === activeId
            const preview = h.task.question.slice(0, 60)
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
                    {h.task.themeLabel}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-tight">
                    {preview}
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
