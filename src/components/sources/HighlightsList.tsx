/**
 * Cross-document highlight aggregation view.
 * Groups all highlights by document, shows text + page + color.
 * Click → opens reader at that page.
 */
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileText, Highlighter } from 'lucide-react'
import { db } from '../../db'
import type { PdfHighlight } from '../../db/schema'
import { useState } from 'react'

interface Props {
  examProfileId: string
}

const COLOR_LABELS: Record<string, string> = {
  '#facc15': 'Yellow',
  '#4ade80': 'Green',
  '#60a5fa': 'Blue',
}

export function HighlightsList({ examProfileId }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [colorFilter, setColorFilter] = useState<string>('')

  const highlights = useLiveQuery(
    () => db.pdfHighlights
      .where('examProfileId').equals(examProfileId)
      .toArray(),
    [examProfileId],
  ) ?? []

  // Load document titles
  const docTitles = useLiveQuery(async () => {
    const docIds = [...new Set(highlights.map(h => h.documentId))]
    const docs = await db.documents.where('id').anyOf(docIds).toArray()
    return new Map(docs.map(d => [d.id, d.title]))
  }, [highlights]) ?? new Map<string, string>()

  const filtered = colorFilter
    ? highlights.filter(h => h.color === colorFilter)
    : highlights

  // Group by document
  const grouped = useMemo(() => {
    const map = new Map<string, PdfHighlight[]>()
    for (const h of filtered) {
      const arr = map.get(h.documentId) ?? []
      arr.push(h)
      map.set(h.documentId, arr)
    }
    // Sort highlights within each doc by page
    for (const arr of map.values()) {
      arr.sort((a, b) => a.pageNumber - b.pageNumber)
    }
    return map
  }, [filtered])

  const uniqueColors = useMemo(() => [...new Set(highlights.map(h => h.color))], [highlights])

  if (highlights.length === 0) {
    return (
      <div className="text-center py-16">
        <Highlighter className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">{t('sources.noHighlights', 'No highlights yet')}</h3>
        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
          {t('sources.highlightsHint', 'Open a PDF and select text to highlight it. All your highlights will appear here.')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Color filter */}
      {uniqueColors.length > 1 && (
        <div className="flex gap-2 items-center">
          <span className="text-xs text-[var(--text-muted)]">Filter:</span>
          <button
            onClick={() => setColorFilter('')}
            className={`px-2 py-1 rounded text-[10px] font-medium ${!colorFilter ? 'bg-[var(--accent-text)] text-white' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'}`}
          >
            All ({highlights.length})
          </button>
          {uniqueColors.map(color => (
            <button
              key={color}
              onClick={() => setColorFilter(f => f === color ? '' : color)}
              className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 ${colorFilter === color ? 'ring-2 ring-[var(--accent-text)]' : ''}`}
              style={{ backgroundColor: color + '30', color: color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {COLOR_LABELS[color] ?? 'Color'}
            </button>
          ))}
        </div>
      )}

      {/* Highlights grouped by document */}
      {[...grouped.entries()].map(([docId, docHighlights]) => (
        <div key={docId} className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-[var(--text-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--text-heading)]">
              {docTitles.get(docId) ?? 'Document'}
            </h3>
            <span className="text-xs text-[var(--text-faint)]">({docHighlights.length})</span>
          </div>
          <div className="space-y-2">
            {docHighlights.map(h => (
              <button
                key={h.id}
                onClick={() => navigate(`/read/${docId}`)}
                className="w-full text-left flex items-start gap-2 p-2 rounded-lg hover:bg-[var(--bg-input)] transition-colors"
              >
                <span
                  className="w-1 shrink-0 rounded-full mt-1"
                  style={{ backgroundColor: h.color, height: '2rem' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-body)] line-clamp-2">{h.text}</p>
                  <p className="text-[10px] text-[var(--text-faint)] mt-0.5">
                    Page {h.pageNumber}
                    {h.note && <span> &middot; {h.note}</span>}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
