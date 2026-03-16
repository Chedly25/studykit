import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '@clerk/clerk-react'
import { useSources } from '../../../hooks/useSources'
import { extractTopicStructure, type ExtractionResult } from '../../../ai/topicExtractor'

interface OnboardingUploadProps {
  examProfileId: string
  onComplete: (result: ExtractionResult) => void
}

type UploadState = 'idle' | 'uploading' | 'analyzing' | 'error'

export function OnboardingUpload({ examProfileId, onComplete }: OnboardingUploadProps) {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const { uploadMultiplePdfs, batchProgress } = useSources(examProfileId)
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: File[]) => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (pdfFiles.length === 0) return

    setState('uploading')
    setError('')

    try {
      await uploadMultiplePdfs(pdfFiles)

      setState('analyzing')
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const result = await extractTopicStructure(examProfileId, token)
      onComplete(result)
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }, [examProfileId, uploadMultiplePdfs, getToken, onComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) handleFiles(files)
  }, [handleFiles])

  if (state === 'uploading') {
    return (
      <div className="glass-card p-8 text-center">
        <Loader2 className="w-10 h-10 text-[var(--accent-text)] mx-auto mb-4 animate-spin" />
        <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
          {t('dashboard.onboarding.uploading')}
        </h3>
        {batchProgress && (
          <div className="mt-4 space-y-2 max-w-sm mx-auto">
            {batchProgress.results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {r.status === 'done' ? (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <span className="text-[var(--text-body)] truncate">{r.fileName}</span>
              </div>
            ))}
            {batchProgress.currentFile && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 text-[var(--accent-text)] animate-spin flex-shrink-0" />
                <span className="text-[var(--text-muted)] truncate">{batchProgress.currentFile}</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (state === 'analyzing') {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-10 h-10 mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-full bg-[var(--accent-text)]/20 animate-ping" />
          <div className="absolute inset-1 rounded-full bg-[var(--accent-text)]/40 animate-pulse" />
          <FileText className="w-10 h-10 text-[var(--accent-text)] relative" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
          {t('dashboard.onboarding.analyzing')}
        </h3>
        <p className="text-sm text-[var(--text-muted)]">
          {t('dashboard.onboarding.analyzingSubtitle')}
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="glass-card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
          {t('dashboard.onboarding.extractionError')}
        </h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">{error}</p>
        <button
          onClick={() => setState('idle')}
          className="btn-primary px-6 py-2"
        >
          {t('dashboard.onboarding.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="glass-card p-8">
      <h2 className="text-xl font-bold text-[var(--text-heading)] mb-2">
        {t('dashboard.onboarding.uploadTitle')}
      </h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        {t('dashboard.onboarding.uploadSubtitle')}
      </p>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragOver
            ? 'border-[var(--accent-text)] bg-[var(--accent-bg)]'
            : 'border-[var(--border-card)] hover:border-[var(--accent-text)]/50 hover:bg-[var(--accent-bg)]/50'
        }`}
      >
        <Upload className={`w-10 h-10 mx-auto mb-4 ${isDragOver ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`} />
        <p className="font-medium text-[var(--text-heading)] mb-1">
          {t('dashboard.onboarding.dropHere')}
        </p>
        <p className="text-sm text-[var(--text-muted)]">
          {t('dashboard.onboarding.orBrowse')}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
