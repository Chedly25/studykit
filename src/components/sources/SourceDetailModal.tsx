import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { getChunksByDocumentId } from '../../lib/sources'
import type { Document, DocumentChunk, Topic } from '../../db/schema'

interface Props {
  document: Document | null
  onClose: () => void
  isSummarizing?: boolean
}

export function SourceDetailModal({ document: doc, onClose, isSummarizing }: Props) {
  const { t } = useTranslation()
  const [chunks, setChunks] = useState<DocumentChunk[]>([])
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null)

  const topics = useLiveQuery(
    () => doc ? db.topics.where('examProfileId').equals(doc.examProfileId).toArray() : [],
    [doc?.examProfileId],
    [],
  )

  const topicMap = new Map<string, string>(topics.map(t => [t.id, t.name]))

  useEffect(() => {
    if (doc) {
      getChunksByDocumentId(doc.id).then(setChunks)
    }
  }, [doc])

  if (!doc) return null

  const handleTopicChange = async (chunkId: string, topicId: string) => {
    await db.documentChunks.update(chunkId, { topicId: topicId || undefined })
    setChunks(prev => prev.map(c => c.id === chunkId ? { ...c, topicId: topicId || undefined } : c))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-card)]">
          <div>
            <h2 className="font-semibold text-[var(--text-heading)]">{doc.title}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {doc.sourceType.toUpperCase()} &middot; {t('sources.words', { count: doc.wordCount })} &middot; {t('sources.chunks', { count: chunks.length })}
            </p>
          </div>
          <button onClick={onClose} className="btn-action p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)]">
            <X size={18} />
          </button>
        </div>

        {isSummarizing && !doc.summary && (
          <div className="px-5 py-4 border-b border-[var(--border-card)] bg-[var(--accent-bg)]/30">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 text-[var(--accent-text)] animate-spin" />
              <span className="text-sm text-[var(--accent-text)] font-medium">{t('sources.summarizing')}</span>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-[var(--border-card)] rounded animate-pulse w-full" />
              <div className="h-3 bg-[var(--border-card)] rounded animate-pulse w-5/6" />
              <div className="h-3 bg-[var(--border-card)] rounded animate-pulse w-4/6" />
            </div>
          </div>
        )}

        {doc.summary && (
          <div className="px-5 py-3 border-b border-[var(--border-card)] bg-[var(--accent-bg)]/30 animate-fade-in">
            <h3 className="text-xs font-semibold text-[var(--accent-text)] mb-1">{t('sources.summary')}</h3>
            <p className="text-sm text-[var(--text-body)]">{doc.summary}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {chunks.map((chunk, i) => {
            const isExpanded = expandedChunk === chunk.id
            return (
              <div key={chunk.id} className="border border-[var(--border-card)] rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedChunk(isExpanded ? null : chunk.id)}
                  className="btn-action w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-input)]"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    Chunk {i + 1}
                  </span>
                  <span className="text-xs text-[var(--text-faint)] truncate flex-1">
                    {chunk.content.slice(0, 80)}...
                  </span>
                  {chunk.topicId && topicMap.get(chunk.topicId) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent-text)]">
                      {topicMap.get(chunk.topicId)}
                    </span>
                  )}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    <p className="text-sm text-[var(--text-body)] whitespace-pre-wrap leading-relaxed">
                      {chunk.content}
                    </p>
                    <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-card)]">
                      <label className="text-xs text-[var(--text-muted)]">Topic:</label>
                      <select
                        value={chunk.topicId ?? ''}
                        onChange={e => handleTopicChange(chunk.id, e.target.value)}
                        className="text-xs px-2 py-1 bg-[var(--bg-input)] border border-[var(--border-input)] rounded text-[var(--text-body)]"
                      >
                        <option value="">Unassigned</option>
                        {topics.map((t: Topic) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
