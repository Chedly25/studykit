/**
 * Drag-drop PDF upload zone for article review.
 */
import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, X, Play } from 'lucide-react'

interface Props {
  onUpload: (files: File[]) => Promise<Array<{ articleId: string; file: File }> | undefined>
  onStartProcessing: (items: Array<{ articleId: string; file: File }>) => void
  articleCount: number
}

export function ReviewArticleUploader({ onUpload, onStartProcessing, articleCount }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const pdfs = Array.from(newFiles).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    setFiles(prev => [...prev, ...pdfs])
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }, [addFiles])

  const handleUploadAndProcess = useCallback(async () => {
    if (files.length === 0) return
    setIsUploading(true)
    try {
      const items = await onUpload(files)
      if (items) {
        setFiles([])
        onStartProcessing(items)
      }
    } finally {
      setIsUploading(false)
    }
  }, [files, onUpload, onStartProcessing])

  return (
    <div className="glass-card p-6 animate-fade-in">
      <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-4 flex items-center gap-2">
        <Upload size={18} className="text-[var(--accent-text)]" />
        Upload Articles
      </h3>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-[var(--accent-text)] bg-[var(--accent-bg)]'
            : 'border-[var(--border-card)] hover:border-[var(--accent-text)]/50'
        }`}
      >
        <Upload size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
        <p className="text-[var(--text-body)] font-medium">
          Drop PDF files here or click to browse
        </p>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Upload 1-50 academic articles for AI-powered review
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={e => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-input)]">
              <FileText size={14} className="text-[var(--accent-text)] flex-shrink-0" />
              <span className="text-sm text-[var(--text-body)] truncate flex-1">{file.name}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {(file.size / 1024 / 1024).toFixed(1)}MB
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                className="p-1 rounded hover:bg-[var(--border-card)] transition-colors"
              >
                <X size={12} className="text-[var(--text-muted)]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      {(files.length > 0 || articleCount > 0) && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-card)]">
          <span className="text-sm text-[var(--text-muted)]">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
            {articleCount > 0 && ` + ${articleCount} already uploaded`}
          </span>
          <button
            onClick={handleUploadAndProcess}
            disabled={files.length === 0 || isUploading}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Upload & Start Analysis
          </button>
        </div>
      )}
    </div>
  )
}
