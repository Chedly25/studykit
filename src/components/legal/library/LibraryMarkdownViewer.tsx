/**
 * Bibliothèque markdown viewer — fetches a chunked JSON file (id/codeName/num/breadcrumb/text)
 * and renders it as continuous prose. Used for Constitution, déontologie/RIN, lois non-codifiées,
 * EU regs, international texts.
 *
 * Strategy: group by top-level breadcrumb segment (or fall back to flat list when empty).
 * Each section gets a heading from the breadcrumb path; chunks render as paragraphs with
 * "Art. {num}" prefixes when num is present.
 */
import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2, AlertTriangle, Search } from 'lucide-react'

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

interface Props {
  url: string
  title?: string
  subtitle?: string
}

interface Section {
  heading: string
  level: number
  chunks: Chunk[]
}

function groupBySection(chunks: Chunk[]): Section[] {
  // Group consecutive chunks that share the same breadcrumb. Empty breadcrumb
  // becomes a single "Texte intégral" section.
  const sections: Section[] = []
  let current: Section | null = null
  for (const c of chunks) {
    const heading = c.breadcrumb || 'Texte intégral'
    const level = c.breadcrumb ? Math.min(4, (c.breadcrumb.split(' > ').length || 1) + 1) : 2
    if (!current || current.heading !== heading) {
      current = { heading, level, chunks: [] }
      sections.push(current)
    }
    current.chunks.push(c)
  }
  return sections
}

function renderChunk(c: Chunk): string {
  const prefix = c.num ? `**Art. ${c.num}** — ` : ''
  return `${prefix}${c.text}`
}

export function LibraryMarkdownViewer({ url, title, subtitle }: Props) {
  const [chunks, setChunks] = useState<Chunk[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setChunks(null)
    setError(null)
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: Chunk[]) => {
        if (!cancelled) setChunks(data)
      })
      .catch(err => {
        if (!cancelled) setError(`Impossible de charger le texte : ${(err as Error).message}`)
      })
    return () => { cancelled = true }
  }, [url])

  const sections = useMemo(() => (chunks ? groupBySection(chunks) : []), [chunks])

  const filtered = useMemo(() => {
    if (!search.trim()) return sections
    const q = search.toLowerCase().trim()
    return sections
      .map(s => ({
        ...s,
        chunks: s.chunks.filter(c => c.text.toLowerCase().includes(q) || c.num.toLowerCase().includes(q)),
      }))
      .filter(s => s.chunks.length > 0)
  }, [sections, search])

  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>{error}</div>
      </div>
    )
  }
  if (!chunks) {
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
      <div className="px-4 py-2 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--bg-input)] max-w-md">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans le texte"
            className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <article className="max-w-3xl mx-auto prose prose-sm dark:prose-invert">
          {filtered.length === 0 ? (
            <p className="text-[var(--text-muted)]">Aucun résultat.</p>
          ) : (
            filtered.map((section, i) => (
              <section key={`${section.heading}-${i}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {`${'#'.repeat(section.level)} ${section.heading}\n\n${section.chunks.map(renderChunk).join('\n\n')}`}
                </ReactMarkdown>
              </section>
            ))
          )}
        </article>
      </div>
    </div>
  )
}
