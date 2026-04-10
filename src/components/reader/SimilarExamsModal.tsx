/**
 * Similar Exams Modal — shows semantically similar problems from other past exams.
 * Uses embeddings for semantic similarity search.
 */
import { useState, useEffect } from 'react'
import { X, Search, FileText } from 'lucide-react'
import { findSimilarChunks, type SimilarChunk } from '../../lib/embeddings'

interface Props {
  sourceChunkId: string | null
  examProfileId: string
  onClose: () => void
}

export default function SimilarExamsModal({ sourceChunkId, examProfileId, onClose }: Props) {
  const [results, setResults] = useState<SimilarChunk[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sourceChunkId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const similar = await findSimilarChunks(sourceChunkId, {
        examProfileId,
        topN: 5,
        category: 'exam',
        minSimilarity: 0.45,
      })
      if (!cancelled) {
        setResults(similar)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [sourceChunkId, examProfileId])

  if (!sourceChunkId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-card max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-[var(--border-card)] bg-[var(--bg-card)] z-10">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-heading)]">
              Sujets similaires
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--text-muted)]">
                Recherche dans les annales...
              </p>
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
              <p className="text-sm text-[var(--text-body)] font-medium mb-1">
                Aucun sujet similaire trouvé
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Upload plus de sujets de concours pour améliorer les résultats.
              </p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                {results.length} sujet{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''} dans tes annales
              </p>
              {results.map((chunk) => (
                <div
                  key={chunk.id}
                  className="p-3 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)]/30 hover:bg-[var(--bg-input)]/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                      <span className="text-xs font-semibold text-[var(--text-heading)] truncate">
                        {chunk.documentTitle}
                      </span>
                      {chunk.pageNumber !== undefined && (
                        <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                          p.{chunk.pageNumber}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">
                      {Math.round(chunk.similarity * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-body)] leading-relaxed line-clamp-4">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
