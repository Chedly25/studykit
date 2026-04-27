/**
 * Fiches de révision setup — three-tab picker:
 *   Thème (canonical FICHE_THEMES dropdown, grouped by matière)
 *   Libre (free-text query)
 *   Depuis mes cours (pick an uploaded document)
 * All paths converge on the same generation call via the hook.
 */
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NotebookPen, Play, Loader2, FileText } from 'lucide-react'
import { FICHE_THEMES, type FicheMatiere } from '../../ai/prompts/legalFichePrompts'
import { useExamProfile } from '../../hooks/useExamProfile'
import { db } from '../../db'

interface Props {
  onStart: (args: {
    source: 'theme' | 'cours' | 'custom'
    theme: string
    themeId?: string
    customQuery?: string
    documentId?: string
  }) => void
  busy?: boolean
  error?: string | null
}

type Tab = 'theme' | 'cours' | 'custom'

const MATIERE_LABEL: Record<FicheMatiere, string> = {
  obligations: 'Droit des obligations',
  civil: 'Droit civil',
  penal: 'Droit pénal',
  affaires: 'Droit des affaires',
  social: 'Droit social',
  administratif: 'Droit administratif',
  fiscal: 'Droit fiscal',
  immobilier: 'Droit immobilier',
  'procedure-civile': 'Procédure civile',
  'procedure-penale': 'Procédure pénale',
  'procedure-administrative': 'Procédure administrative',
  libertes: 'Libertés fondamentales',
}

export function LegalFicheSetup({ onStart, busy, error }: Props) {
  const [tab, setTab] = useState<Tab>('theme')
  const { activeProfile } = useExamProfile()

  // Theme tab state
  const [themeId, setThemeId] = useState<string>(FICHE_THEMES[0]?.id ?? '')

  // Custom tab state
  const [customQuery, setCustomQuery] = useState('')

  // Cours tab state
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [coursQuery, setCoursQuery] = useState('')

  const documents = useLiveQuery(
    async () => {
      if (!activeProfile?.id) return []
      return db.documents
        .where('examProfileId').equals(activeProfile.id)
        .reverse()
        .sortBy('createdAt')
    },
    [activeProfile?.id],
  ) ?? []

  const grouped = useMemo(() => {
    const by: Partial<Record<FicheMatiere, typeof FICHE_THEMES>> = {}
    for (const t of FICHE_THEMES) {
      (by[t.matiere] ?? (by[t.matiere] = [])).push(t)
    }
    return by
  }, [])

  const selectedTheme = FICHE_THEMES.find(t => t.id === themeId)

  const handleStart = () => {
    if (tab === 'theme' && selectedTheme) {
      onStart({ source: 'theme', theme: selectedTheme.label, themeId: selectedTheme.id })
    } else if (tab === 'custom' && customQuery.trim()) {
      onStart({ source: 'custom', theme: deriveTitleFromQuery(customQuery), customQuery: customQuery.trim() })
    } else if (tab === 'cours' && documentId) {
      const doc = documents.find(d => d.id === documentId)
      if (!doc) return
      onStart({
        source: 'cours',
        theme: doc.title,
        documentId,
        customQuery: coursQuery.trim() || undefined,
      })
    }
  }

  const canStart = !busy && (
    (tab === 'theme' && !!selectedTheme) ||
    (tab === 'custom' && customQuery.trim().length > 3) ||
    (tab === 'cours' && !!documentId)
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
          <NotebookPen className="w-5 h-5 text-[var(--accent-text)]" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
            Fiches de révision
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Une fiche dense et structurée sur un thème, ancrée dans tes cours et la base légale.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-[var(--border-card)]">
        <TabButton active={tab === 'theme'} onClick={() => setTab('theme')} label="Thème" />
        <TabButton active={tab === 'custom'} onClick={() => setTab('custom')} label="Libre" />
        <TabButton active={tab === 'cours'} onClick={() => setTab('cours')} label="Depuis mes cours" />
      </div>

      <div className="glass-card p-5 space-y-5">
        {tab === 'theme' && (
          <section className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-heading)]">
              Thème CRFPA
            </label>
            <select
              value={themeId}
              onChange={e => setThemeId(e.target.value)}
              disabled={busy}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-text)] focus:outline-none disabled:opacity-60"
            >
              {(Object.keys(grouped) as FicheMatiere[]).map(matiere => (
                <optgroup key={matiere} label={MATIERE_LABEL[matiere]}>
                  {grouped[matiere]!.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-[var(--text-muted)]">
              32 thèmes curés — droit des obligations, spécialités, procédures, libertés fondamentales.
            </p>
          </section>
        )}

        {tab === 'custom' && (
          <section className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-heading)]">
              Formulation libre
            </label>
            <input
              type="text"
              value={customQuery}
              onChange={e => setCustomQuery(e.target.value)}
              disabled={busy}
              placeholder="ex : fiche sur la responsabilité du fait des choses"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-text)] focus:outline-none disabled:opacity-60"
            />
            <p className="text-xs text-[var(--text-muted)]">
              Décris le thème en une phrase. L'IA choisit le titre et la matière automatiquement.
            </p>
          </section>
        )}

        {tab === 'cours' && (
          <section className="space-y-3">
            <label className="text-sm font-semibold text-[var(--text-heading)]">
              Document source
            </label>
            {documents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border-card)] p-6 text-center">
                <FileText className="w-6 h-6 mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-sm text-[var(--text-muted)]">
                  Aucun cours téléversé pour l'instant.
                </p>
                <a href="/sources" className="inline-block mt-2 text-xs text-[var(--accent-text)] hover:underline">
                  Ajouter un cours
                </a>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] p-2">
                {documents.map(d => {
                  const active = d.id === documentId
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDocumentId(d.id)}
                      disabled={busy}
                      className={`w-full flex items-start gap-2 p-2 rounded text-left transition-colors ${
                        active
                          ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{d.title}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {d.wordCount.toLocaleString('fr')} mots
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            <label className="text-sm font-semibold text-[var(--text-heading)] block pt-1">
              Sous-thème (optionnel)
            </label>
            <input
              type="text"
              value={coursQuery}
              onChange={e => setCoursQuery(e.target.value)}
              disabled={busy || !documentId}
              placeholder="ex : la rupture brutale"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-text)] focus:outline-none disabled:opacity-60"
            />
            <p className="text-xs text-[var(--text-muted)]">
              Laisse vide pour une fiche sur l'ensemble du document, ou précise une notion.
            </p>
          </section>
        )}

        <div className="rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] p-3 text-xs text-[var(--text-muted)] leading-relaxed">
          La fiche est générée à partir d'un pool de références réelles (articles + jurisprudence) et de tes cours téléversés. Toute citation est vérifiée pour éviter les références fabriquées. La rédaction prend 1 à 2 minutes. Une section « Actualité » se complète automatiquement à partir de sources officielles (Cour de cassation, Conseil d'État, Dalloz Actualité…).
        </div>

        {error && (
          <div className="glass-card p-3 text-sm text-rose-600 dark:text-rose-400 border border-rose-500/30">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {busy ? 'Génération en cours…' : 'Générer la fiche'}
        </button>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${
        active
          ? 'border-[var(--accent-text)] text-[var(--accent-text)] font-medium'
          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]'
      }`}
    >
      {label}
    </button>
  )
}

function deriveTitleFromQuery(query: string): string {
  const trimmed = query.trim()
  const withoutPrefix = trimmed.replace(/^(fiche|une fiche|petite fiche)\s+(sur|de|du|des|à propos de|concernant)\s+/i, '')
  const capped = withoutPrefix.charAt(0).toUpperCase() + withoutPrefix.slice(1)
  return capped.length > 80 ? capped.slice(0, 77) + '…' : capped
}
