import { FileText, FileType, ClipboardPaste, Trash2, Eye, Sparkles, BookOpen, ClipboardCheck } from 'lucide-react'
import type { Document } from '../../db/schema'

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileType,
  text: FileText,
  paste: ClipboardPaste,
  url: BookOpen,
  image: FileText,
}

interface Props {
  document: Document
  onView: () => void
  onDelete: () => void
  onSummarize: () => void
  onGenerateFlashcards: () => void
  onGeneratePracticeExam: () => void
}

export function SourceCard({
  document: doc,
  onView,
  onDelete,
  onSummarize,
  onGenerateFlashcards,
  onGeneratePracticeExam,
}: Props) {
  const Icon = typeIcons[doc.sourceType] ?? FileText
  const date = new Date(doc.createdAt).toLocaleDateString()

  return (
    <div className="glass-card p-4 flex flex-col gap-3 group">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-[var(--accent-text)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-[var(--text-heading)] truncate" title={doc.title}>
            {doc.title}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {doc.sourceType.toUpperCase()} &middot; {date}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-[var(--text-faint)]">
        <span>{doc.wordCount.toLocaleString()} words</span>
        <span>&middot;</span>
        <span>{doc.chunkCount} chunks</span>
        {doc.summary && (
          <>
            <span>&middot;</span>
            <span className="text-green-500">Summarized</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
        <button
          onClick={onView}
          className="text-xs px-2 py-1 rounded-md bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors flex items-center gap-1"
        >
          <Eye size={12} /> View
        </button>
        <button
          onClick={onSummarize}
          className="text-xs px-2 py-1 rounded-md bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors flex items-center gap-1"
        >
          <Sparkles size={12} /> Summarize
        </button>
        <button
          onClick={onGenerateFlashcards}
          className="text-xs px-2 py-1 rounded-md bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors flex items-center gap-1"
        >
          <BookOpen size={12} /> Flashcards
        </button>
        <button
          onClick={onGeneratePracticeExam}
          className="text-xs px-2 py-1 rounded-md bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors flex items-center gap-1"
        >
          <ClipboardCheck size={12} /> Exam
        </button>
        <button
          onClick={onDelete}
          className="text-xs px-2 py-1 rounded-md bg-[var(--bg-input)] text-red-400 hover:text-red-500 transition-colors flex items-center gap-1 ml-auto"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  )
}
