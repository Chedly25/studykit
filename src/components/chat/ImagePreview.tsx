/**
 * Image preview with extracted text — shown above the chat input.
 */
import { useState } from 'react'
import { X, ChevronDown, ChevronUp, Loader2, FileText, Save } from 'lucide-react'

interface Props {
  imageUrl: string
  extractedText: string | null
  isExtracting: boolean
  onRemove: () => void
  onSaveToLibrary?: () => void
}

export function ImagePreview({ imageUrl, extractedText, isExtracting, onRemove, onSaveToLibrary }: Props) {
  const [textExpanded, setTextExpanded] = useState(false)
  const wordCount = extractedText ? extractedText.split(/\s+/).length : 0

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)]">
      {/* Thumbnail */}
      <img
        src={imageUrl}
        alt="Captured"
        className="w-16 h-16 rounded-lg object-cover shrink-0"
      />

      <div className="flex-1 min-w-0">
        {isExtracting ? (
          <div className="flex items-center gap-2 text-xs text-[var(--accent-text)]">
            <Loader2 className="w-3 h-3 animate-spin" />
            Extracting text...
          </div>
        ) : extractedText ? (
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-3 h-3 text-[var(--accent-text)]" />
              <span className="text-xs text-[var(--accent-text)] font-medium">{wordCount} words extracted</span>
              <button
                onClick={() => setTextExpanded(!textExpanded)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] flex items-center gap-0.5"
              >
                {textExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {textExpanded ? 'Hide' : 'Show'}
              </button>
            </div>
            {textExpanded && (
              <p className="text-xs text-[var(--text-body)] mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap">
                {extractedText.slice(0, 500)}{extractedText.length > 500 ? '...' : ''}
              </p>
            )}
            {onSaveToLibrary && (
              <button
                onClick={onSaveToLibrary}
                className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-text)] mt-1"
              >
                <Save className="w-3 h-3" /> Save to library
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs text-[var(--color-error)]">Failed to extract text</span>
        )}
      </div>

      <button
        onClick={onRemove}
        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-body)] shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
