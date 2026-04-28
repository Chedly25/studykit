/**
 * Bibliothèque code reader — fetches a code JSON (chunked: id/codeName/num/breadcrumb/text),
 * builds a livre/titre/chapitre tree from the breadcrumb field, lets the user navigate
 * + read individual articles. Handles ~10k articles per code without virtualization
 * (the tree is collapsed by default so render cost is bounded).
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, ChevronRight, ChevronDown, Search, AlertTriangle } from 'lucide-react'

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

interface TreeNode {
  label: string
  /** Full breadcrumb up to this node, kept for unique addressing. */
  path: string
  children: Map<string, TreeNode>
  /** Articles directly attached at this depth. */
  articles: Chunk[]
}

interface Props {
  /** Public URL of the code JSON, e.g. "/library/codes/code-civil.json". */
  url: string
  /** Display title shown above the tree. */
  title: string
  /** Optional initial article number to scroll to (deep-link). */
  initialArticle?: string
}

function buildTree(chunks: Chunk[]): TreeNode {
  const root: TreeNode = { label: '', path: '', children: new Map(), articles: [] }
  for (const c of chunks) {
    const parts = (c.breadcrumb || '').split(' > ').map(p => p.trim()).filter(Boolean)
    let node = root
    let path = ''
    for (const part of parts) {
      path = path ? `${path} > ${part}` : part
      let next = node.children.get(part)
      if (!next) {
        next = { label: part, path, children: new Map(), articles: [] }
        node.children.set(part, next)
      }
      node = next
    }
    node.articles.push(c)
  }
  return root
}

function TreeBranch({
  node,
  depth,
  expanded,
  onToggle,
  onSelectArticle,
  selectedArticleId,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  onSelectArticle: (c: Chunk) => void
  selectedArticleId: string | null
}) {
  const isOpen = depth === 0 || expanded.has(node.path)
  const hasChildren = node.children.size > 0 || node.articles.length > 0

  return (
    <div>
      {depth > 0 && (
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.path)}
          className="flex items-start gap-1 w-full text-left px-1 py-1 rounded hover:bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)]"
          style={{ paddingLeft: `${depth * 10 + 4}px` }}
        >
          {hasChildren ? (
            isOpen
              ? <ChevronDown className="w-3 h-3 mt-0.5 shrink-0 text-[var(--text-muted)]" />
              : <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-[var(--text-muted)]" />
          ) : <span className="w-3 shrink-0" />}
          <span className="leading-tight">{node.label}</span>
        </button>
      )}
      {isOpen && (
        <>
          {[...node.children.values()].map(child => (
            <TreeBranch
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelectArticle={onSelectArticle}
              selectedArticleId={selectedArticleId}
            />
          ))}
          {node.articles.map(article => (
            <button
              key={article.id}
              type="button"
              onClick={() => onSelectArticle(article)}
              className={`w-full text-left px-1 py-1 rounded text-[11px] ${
                selectedArticleId === article.id
                  ? 'bg-[var(--accent-bg)] text-[var(--accent-text)] font-medium'
                  : 'hover:bg-[var(--bg-hover)] text-[var(--text-muted)]'
              }`}
              style={{ paddingLeft: `${(depth + 1) * 10 + 4}px` }}
            >
              Art. {article.num}
            </button>
          ))}
        </>
      )}
    </div>
  )
}

export function CodeTreeBrowser({ url, title, initialArticle }: Props) {
  const [chunks, setChunks] = useState<Chunk[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const articleParam = searchParams.get('article') ?? initialArticle ?? null
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
        if (!cancelled) setError(`Impossible de charger le code : ${(err as Error).message}`)
      })
    return () => { cancelled = true }
  }, [url])

  // Resolve ?article=… deep-link to the matching chunk id once chunks load.
  useEffect(() => {
    if (!chunks || !articleParam) return
    const match = chunks.find(c => c.num === articleParam)
    if (match) setSelectedId(match.id)
  }, [chunks, articleParam])

  const tree = useMemo(() => (chunks ? buildTree(chunks) : null), [chunks])

  const filtered = useMemo(() => {
    if (!chunks || !searchQuery.trim()) return null
    const q = searchQuery.toLowerCase().trim()
    return chunks.filter(c =>
      c.num.toLowerCase().includes(q) || c.text.toLowerCase().includes(q),
    ).slice(0, 100) // cap to keep render bounded
  }, [chunks, searchQuery])

  const selected = chunks?.find(c => c.id === selectedId) ?? null

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }

  const selectArticle = (c: Chunk) => {
    setSelectedId(c.id)
    // Persist to URL so refresh / share preserves selection.
    const next = new URLSearchParams(searchParams)
    next.set('article', c.num)
    setSearchParams(next, { replace: true })
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>{error}</div>
      </div>
    )
  }
  if (!chunks || !tree) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Chargement du code…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--border-card)]">
        <h2 className="text-base font-semibold text-[var(--text-heading)]">{title}</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{chunks.length.toLocaleString('fr')} articles</p>
      </div>
      <div className="flex flex-1 min-h-0">
        <aside className="w-72 border-r border-[var(--border-card)] flex flex-col min-h-0">
          <div className="p-2 border-b border-[var(--border-card)]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--bg-input)]">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="N° d'article ou mot-clé"
                className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {filtered ? (
              <div>
                {filtered.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] px-3 py-2">Aucun résultat.</p>
                ) : (
                  filtered.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectArticle(c)}
                      className={`block w-full text-left px-3 py-1.5 text-[11px] ${
                        selectedId === c.id
                          ? 'bg-[var(--accent-bg)] text-[var(--accent-text)] font-medium'
                          : 'hover:bg-[var(--bg-hover)] text-[var(--text-muted)]'
                      }`}
                    >
                      <span className="font-medium">Art. {c.num}</span>
                      <span className="text-[10px] ml-2 opacity-70 truncate inline-block max-w-[180px] align-bottom">
                        {c.text.slice(0, 60)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <TreeBranch
                node={tree}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                onSelectArticle={selectArticle}
                selectedArticleId={selectedId}
              />
            )}
          </div>
        </aside>
        <div className="flex-1 overflow-y-auto p-6">
          {selected ? (
            <article className="max-w-3xl mx-auto">
              <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-1">
                Article {selected.num}
              </h3>
              {selected.breadcrumb && (
                <p className="text-xs text-[var(--text-muted)] mb-4">{selected.breadcrumb}</p>
              )}
              <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {selected.text}
              </p>
            </article>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
              Sélectionne un article dans le sommaire.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
