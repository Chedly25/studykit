/**
 * Inline markdown editor for a fiche.
 * Simple textarea + live preview split — no CodeMirror setup for v1 (can upgrade later).
 * Keystroke-level localStorage autosave so navigating away mid-edit doesn't lose work;
 * explicit Save / Discard buttons for clarity.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, X, Save } from 'lucide-react'

interface Props {
  /** Used to key the localStorage draft. Pass the fiche id. */
  ficheId: string
  initialContent: string
  onSave: (content: string) => Promise<void> | void
  onCancel: () => void
}

const DRAFT_KEY = (id: string) => `studyskit.draft.legalFicheEditor.${id}`
const AUTOSAVE_DEBOUNCE_MS = 500

function readDraft(id: string): string | null {
  try { return localStorage.getItem(DRAFT_KEY(id)) ?? null } catch { return null }
}
function writeDraft(id: string, content: string): void {
  try { localStorage.setItem(DRAFT_KEY(id), content) } catch { /* noop */ }
}
function clearDraft(id: string): void {
  try { localStorage.removeItem(DRAFT_KEY(id)) } catch { /* noop */ }
}

export function LegalFicheEditor({ ficheId, initialContent, onSave, onCancel }: Props) {
  // Restore draft once on mount if it exists and differs from server version.
  const [content, setContent] = useState(() => {
    const draft = readDraft(ficheId)
    return draft && draft !== initialContent ? draft : initialContent
  })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(() => {
    const draft = readDraft(ficheId)
    return !!draft && draft !== initialContent
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // If fiche id changes, reset state from that fiche's snapshot.
    const draft = readDraft(ficheId)
    setContent(draft && draft !== initialContent ? draft : initialContent)
    setDirty(!!draft && draft !== initialContent)
  }, [ficheId, initialContent])

  useEffect(() => {
    if (!dirty) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => writeDraft(ficheId, content), AUTOSAVE_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [ficheId, content, dirty])

  const charCount = useMemo(() => content.length, [content])
  const wordCount = useMemo(() => content.trim() ? content.trim().split(/\s+/).length : 0, [content])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(content)
      clearDraft(ficheId)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    clearDraft(ficheId)
    onCancel()
  }

  return (
    <div className="max-w-7xl mx-auto w-full flex flex-col h-[calc(100vh-8rem)] p-4 gap-3">
      <div className="glass-card p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-[var(--text-muted)] tabular-nums">
          {wordCount.toLocaleString('fr')} mots · {charCount.toLocaleString('fr')} caractères
          {dirty && <span className="ml-2 text-[var(--color-warning)]">● modifications non enregistrées</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] border border-[var(--border-card)]"
          >
            <X className="w-4 h-4" /> Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-bg)] text-[var(--accent-text)] disabled:opacity-40 hover:opacity-90"
          >
            {saving ? <Save className="w-4 h-4 animate-pulse" /> : <Check className="w-4 h-4" />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
        <div className="glass-card overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 border-b border-[var(--border-card)] text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
            Markdown
          </div>
          <textarea
            value={content}
            onChange={e => { setContent(e.target.value); setDirty(true) }}
            className="flex-1 w-full bg-transparent px-3 py-2 text-xs font-mono text-[var(--text-primary)] focus:outline-none resize-none leading-relaxed"
            spellCheck={false}
          />
        </div>
        <div className="glass-card overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 border-b border-[var(--border-card)] text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
            Aperçu
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
