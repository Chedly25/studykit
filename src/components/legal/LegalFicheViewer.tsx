/**
 * Legal fiche viewer — renders Markdown with special treatment for the
 * Actualité section (shows a loader while enrichment is pending).
 */
import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  RefreshCw, Pencil, Printer, Search, Loader2, AlertTriangle, StickyNote, Check,
} from 'lucide-react'
import type { LegalFicheView } from '../../ai/coaching/legalFicheStore'
import { ACTUALITE_MARKER } from '../../ai/prompts/legalFichePrompts'

/**
 * Slugify plain text → kebab-case ASCII, safe for an HTML `id`.
 * Handles French accents explicitly so "Régime juridique" → "regime-juridique"
 * and intra-document links like [Régime](#regime-juridique) resolve.
 */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function headingText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(headingText).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    const props = (children as { props?: { children?: React.ReactNode } }).props
    return headingText(props?.children ?? '')
  }
  return ''
}

interface Props {
  fiche: LegalFicheView
  isEnriching: boolean
  onEdit: () => void
  onRegenerate: () => void
  onPrint: () => void
  onRefreshActualite: () => void
  onSaveAnnotation: (sectionKey: string, note: string) => Promise<void> | void
}

export function LegalFicheViewer({
  fiche,
  isEnriching,
  onEdit,
  onRegenerate,
  onPrint,
  onRefreshActualite,
  onSaveAnnotation,
}: Props) {
  // Insert a placeholder around the Actualité marker so we can render a loader in its place.
  const content = useMemo(() => {
    if (!isEnriching && fiche.actualiteStatus !== 'pending') return fiche.content
    // Replace both the bare marker and an empty Actualité section
    if (fiche.content.includes(ACTUALITE_MARKER)) {
      return fiche.content.replace(ACTUALITE_MARKER, '[[ACTUALITE_LOADER]]')
    }
    return fiche.content
  }, [fiche.content, fiche.actualiteStatus, isEnriching])

  const sourceLabel = fiche.source === 'theme'
    ? 'Thème'
    : fiche.source === 'cours' ? 'Depuis cours' : 'Libre'

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold">
              {sourceLabel}
            </span>
            {fiche.matiere && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                {fiche.matiere}
              </span>
            )}
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              v{fiche.version}
            </span>
            <ActualiteStatusBadge status={fiche.actualiteStatus} />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Mise à jour {formatDate(fiche.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ActionButton icon={<Search className="w-4 h-4" />} onClick={onRefreshActualite} disabled={isEnriching} label="Chercher des actualités" />
          <ActionButton icon={<RefreshCw className="w-4 h-4" />} onClick={onRegenerate} disabled={isEnriching} label="Régénérer" />
          <ActionButton icon={<Pencil className="w-4 h-4" />} onClick={onEdit} disabled={isEnriching} label="Éditer" />
          <ActionButton icon={<Printer className="w-4 h-4" />} onClick={onPrint} disabled={isEnriching} label="Exporter PDF" />
        </div>
      </div>

      {/* Fiche body */}
      <article className="glass-card p-6 prose prose-sm dark:prose-invert max-w-none print-fiche">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => <h2 id={slugify(headingText(children))}>{children}</h2>,
            h3: ({ children }) => <h3 id={slugify(headingText(children))}>{children}</h3>,
            p: ({ children }) => {
              const childArr = Array.isArray(children) ? children : [children]
              const first = typeof childArr[0] === 'string' ? childArr[0] : ''
              if (first === '[[ACTUALITE_LOADER]]') {
                return <ActualiteLoader />
              }
              return <p>{children}</p>
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </article>

      {fiche.actualiteStatus === 'failed' && fiche.actualiteError && (
        <div className="glass-card p-3 text-xs text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Actualité non récupérée</div>
            <div className="text-[var(--text-muted)]">{fiche.actualiteError}</div>
          </div>
        </div>
      )}

      <AnnotationsPanel
        key={fiche.id}
        initialNote={fiche.userAnnotations.general ?? ''}
        onSave={note => onSaveAnnotation('general', note)}
      />
    </div>
  )
}

function AnnotationsPanel({
  initialNote,
  onSave,
}: {
  initialNote: string
  onSave: (note: string) => Promise<void> | void
}) {
  // State is initialized from props; parent remounts this panel via `key={fiche.id}`
  // when a different fiche loads, so we don't need a sync effect here.
  const [note, setNote] = useState(initialNote)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)

  const handleSave = async () => {
    await onSave(note)
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="glass-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)]">
          <StickyNote className="w-4 h-4 text-[var(--accent-text)]" />
          Mes notes
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-[var(--accent-bg)] text-[var(--accent-text)] disabled:opacity-40 hover:opacity-90"
        >
          {saved ? <Check className="w-3.5 h-3.5" /> : null}
          {saved ? 'Enregistré' : 'Enregistrer la note'}
        </button>
      </div>
      <textarea
        value={note}
        onChange={e => { setNote(e.target.value); setDirty(true); setSaved(false) }}
        rows={4}
        placeholder="Ajoute ici tes remarques, pièges repérés, mnémotechniques personnelles. Les notes sont sauvegardées dans la fiche."
        className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-text)] focus:outline-none resize-y"
      />
    </div>
  )
}

function ActionButton({ icon, onClick, disabled, label }: { icon: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-body)] hover:bg-[var(--bg-hover)] border border-[var(--border-card)] disabled:opacity-40 transition-colors"
    >
      {icon}
      {label}
    </button>
  )
}

function ActualiteLoader() {
  return (
    <div className="not-prose rounded-lg border border-dashed border-[var(--accent-text)]/40 bg-[var(--accent-bg)]/30 p-3 flex items-center gap-2 text-sm text-[var(--text-muted)] my-2">
      <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" />
      <span>Recherche d'actualités récentes en cours…</span>
    </div>
  )
}

function ActualiteStatusBadge({ status }: { status: LegalFicheView['actualiteStatus'] }) {
  if (status === 'pending') {
    return (
      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
        Actualité en cours
      </span>
    )
  }
  if (status === 'auto-enriched' || status === 'manually-enriched') {
    return (
      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
        Actualité enrichie
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold">
        Actualité échouée
      </span>
    )
  }
  return null
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}
