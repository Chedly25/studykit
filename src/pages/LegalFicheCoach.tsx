/**
 * CRFPA Fiches de révision page.
 * Setup → Viewer (with auto-enrichment + manual "Chercher actualités") → optional Editor.
 */
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loader2, Menu, Trash2, X, NotebookPen } from 'lucide-react'
import { LegalPageTabs } from '../components/legal/LegalPageTabs'
import { LegalFicheSetup } from '../components/legal/LegalFicheSetup'
import { LegalFicheViewer } from '../components/legal/LegalFicheViewer'
import { LegalFicheEditor } from '../components/legal/LegalFicheEditor'
import { useLegalFiche } from '../hooks/useLegalFiche'

type Mode = 'view' | 'edit'

export default function LegalFicheCoach() {
  const {
    phase,
    fiche,
    history,
    error,
    generate,
    regenerate,
    saveEdit,
    saveAnnotation,
    enrichActualite,
    loadFiche,
    removeFiche,
    reset,
    cancel,
  } = useLegalFiche()

  const [historyOpen, setHistoryOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('view')

  const [searchParams, setSearchParams] = useSearchParams()
  const loadedRef = useRef<string | null>(null)
  useEffect(() => {
    const id = searchParams.get('fiche')
    if (!id || loadedRef.current === id) return
    loadedRef.current = id
    loadFiche(id).then(() => {
      setSearchParams({}, { replace: true })
    })
  }, [searchParams, loadFiche, setSearchParams])

  const busy = phase === 'generating'
  const isEnriching = phase === 'enriching' || fiche?.actualiteStatus === 'pending'

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <Helmet>
        <title>Fiches de révision — CRFPA | StudiesKit</title>
        <meta
          name="description"
          content="Fiches de révision CRFPA générées à partir des codes, de la jurisprudence et de tes cours, avec actualités vérifiées."
        />
      </Helmet>

      <LegalPageTabs />

      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border-card)] shrink-0">
          <HistoryList
            history={history}
            activeId={fiche?.id ?? null}
            onSelect={id => { loadFiche(id); setMode('view') }}
            onDelete={removeFiche}
            onNew={() => { reset(); setMode('view') }}
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
                activeId={fiche?.id ?? null}
                onSelect={id => { loadFiche(id); setMode('view'); setHistoryOpen(false) }}
                onDelete={removeFiche}
                onNew={() => { reset(); setMode('view'); setHistoryOpen(false) }}
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
            <NotebookPen className="w-5 h-5 text-[var(--accent-text)]" />
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-heading)]">Fiches de révision</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Dense · ancrée dans tes cours · actualités vérifiées.
              </p>
            </div>
          </div>

          {phase === 'idle' && !fiche && (
            <LegalFicheSetup
              onStart={args => { setMode('view'); generate(args) }}
              error={error}
            />
          )}

          {busy && (
            <CenteredSpinner
              label="Rédaction de la fiche — pool de références, génération, vérification. 1 à 2 min."
              onCancel={cancel}
            />
          )}

          {!busy && fiche && mode === 'view' && (
            <LegalFicheViewer
              fiche={fiche}
              isEnriching={isEnriching}
              onEdit={() => setMode('edit')}
              onRegenerate={regenerate}
              onPrint={handlePrint}
              onRefreshActualite={enrichActualite}
              onSaveAnnotation={saveAnnotation}
            />
          )}

          {!busy && fiche && mode === 'edit' && (
            <LegalFicheEditor
              ficheId={fiche.id}
              initialContent={fiche.content}
              onSave={async content => { await saveEdit(content); setMode('view') }}
              onCancel={() => setMode('view')}
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
  history: ReturnType<typeof useLegalFiche>['history']
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
          Nouvelle fiche
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center mt-6 px-3">
            Pas encore de fiche. Crée ta première ici.
          </p>
        ) : (
          history.map(h => {
            const isActive = h.id === activeId
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
                    {h.theme}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {h.matiere ?? h.source} · v{h.version}
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
