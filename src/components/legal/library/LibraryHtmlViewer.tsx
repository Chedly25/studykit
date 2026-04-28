/**
 * Bibliothèque HTML viewer — fetches a sanitize-then-render HTML file from
 * /library/cc/. Used for the 42 Conseil constitutionnel decisions.
 *
 * Sanitization via DOMPurify; we drop scripts, event handlers, iframes, etc.
 */
import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { Loader2, AlertTriangle } from 'lucide-react'

interface Props {
  /** Public URL, e.g. "/library/cc/2024-2024-1089-QPC.html". */
  url: string
  title?: string
  subtitle?: string
}

export function LibraryHtmlViewer({ url, title, subtitle }: Props) {
  const [raw, setRaw] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRaw(null)
    setError(null)
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then(text => {
        if (!cancelled) setRaw(text)
      })
      .catch(err => {
        if (!cancelled) setError(`Impossible de charger la décision : ${(err as Error).message}`)
      })
    return () => { cancelled = true }
  }, [url])

  const sanitized = useMemo(() => {
    if (!raw) return ''
    return DOMPurify.sanitize(raw, {
      // Conseil constitutionnel decisions are mostly plain HTML — paragraphs,
      // headings, lists. Strip script/iframe/embed/object/style/link by default.
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style', 'link', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    })
  }, [raw])

  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-sm text-[var(--color-warning)] ">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>{error}</div>
      </div>
    )
  }

  if (!raw) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-[var(--text-muted)]">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Chargement…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {(title || subtitle) && (
        <header className="px-4 py-3 border-b border-[var(--border-card)]">
          {title && <h2 className="text-base font-semibold text-[var(--text-heading)]">{title}</h2>}
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </header>
      )}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <article
          className="max-w-3xl mx-auto prose prose-sm dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      </div>
    </div>
  )
}
