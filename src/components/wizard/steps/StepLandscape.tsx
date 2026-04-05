import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { toast } from 'sonner'
import { Upload, FileText, Type, PenTool, Loader2, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react'
import { useSources } from '../../../hooks/useSources'
import { extractTopicStructureStreaming } from '../../../ai/topicExtractor'
import { extractLandscapeFromTextStreaming } from '../../../ai/landscapeExtractor'
import { processFile } from '../../../lib/fileProcessor'
import { createDocument, saveChunks } from '../../../lib/sources'
import { TopicMapEditor } from '../TopicMapEditor'
import type { WizardDraft, WizardAction, DraftSubject } from '../../../hooks/useWizardDraft'
import type { ExtractedSubject } from '../../../ai/topicExtractor'

type InputTab = 'upload' | 'paste' | 'freetext' | 'manual'
type ProcessingState = 'idle' | 'uploading' | 'analyzing' | 'streaming' | 'error'

interface StepLandscapeProps {
  draft: WizardDraft
  dispatch: React.Dispatch<WizardAction>
  onNext: () => void
  onBack: () => void
}

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4']

function extractedToDraft(subject: ExtractedSubject, index: number): DraftSubject {
  // Build chapters if the AI returned 3-level data
  const chapters = subject.chapters && subject.chapters.length > 0
    ? subject.chapters.map(ch => ({
        tempId: crypto.randomUUID(),
        name: ch.name,
        topics: ch.topics.map(t => ({ tempId: crypto.randomUUID(), name: t.name })),
      }))
    : undefined

  // Flat topics list (always populated for backward compat)
  const flatTopics = chapters
    ? chapters.flatMap(ch => ch.topics)
    : subject.topics.map(t => ({ tempId: crypto.randomUUID(), name: t.name }))

  return {
    tempId: crypto.randomUUID(),
    name: subject.name,
    weight: subject.weight,
    color: COLORS[index % COLORS.length],
    topics: flatTopics,
    chapters,
  }
}

export function StepLandscape({ draft, dispatch, onNext, onBack }: StepLandscapeProps) {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const { batchProgress } = useSources(draft.profileId!)

  const isResearch = draft.profileMode === 'research'
  const [activeTab, setActiveTab] = useState<InputTab>(isResearch ? 'freetext' : 'upload')
  const [processingState, setProcessingState] = useState<ProcessingState>('idle')
  const [error, setError] = useState('')
  const [pasteContent, setPasteContent] = useState('')
  const [freetextContent, setFreetextContent] = useState(draft.researchQuestion || '')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasSubjects = draft.subjects.length > 0
  const canContinue = hasSubjects && draft.subjects.every(s => s.name.trim() && s.topics.length > 0)

  // Upload handler — parallel file save + streaming extraction
  const handleFiles = useCallback(async (files: File[]) => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (pdfFiles.length === 0) return

    setProcessingState('uploading')
    setError('')

    let subjectCount = 0

    try {
      // Step 1: Process files in memory
      const processed = await Promise.all(pdfFiles.map(f => processFile(f)))
      const combinedText = processed.map(p => p.text).join('\n\n---\n\n')

      setProcessingState('analyzing')

      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      // Step 2: Parallel DB save + streaming extraction
      const savePromise = Promise.all(processed.map(async (p) => {
        const doc = await createDocument(draft.profileId!, p.title, 'pdf', p.text)
        await saveChunks(doc.id, draft.profileId!, p.chunks)
      })).catch(saveErr => {
        // Surface save failures as a toast, don't block extraction
        toast.error(`Document save failed: ${saveErr instanceof Error ? saveErr.message : 'Unknown error'}`)
      })

      const extractionPromise = extractTopicStructureStreaming(
        draft.profileId!,
        token,
        (subject, index) => {
          subjectCount++
          dispatch({ type: 'APPEND_SUBJECT', subject: extractedToDraft(subject, index) })
          if (index === 0) {
            setProcessingState('streaming')
            dispatch({ type: 'SET_LANDSCAPE_SOURCE', source: 'upload' })
          }
        },
        undefined,
        undefined,
        combinedText,
      )

      // Save failure is handled above; only extraction failure propagates
      const [extractionResult] = await Promise.allSettled([extractionPromise, savePromise])
      if (extractionResult.status === 'rejected') throw extractionResult.reason
      setProcessingState('idle')
    } catch (err) {
      if (subjectCount > 0) {
        setProcessingState('idle')
        toast.error(err instanceof Error ? err.message : 'Analysis incomplete')
      } else {
        setProcessingState('error')
        setError(err instanceof Error ? err.message : 'Upload failed')
      }
    }
  }, [draft.profileId, getToken, dispatch])

  // Paste/Freetext extraction handler — streaming
  const handleTextExtract = useCallback(async (text: string, source: 'paste' | 'freetext') => {
    if (!text.trim()) return

    setProcessingState('analyzing')
    setError('')

    let subjectCount = 0

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      await extractLandscapeFromTextStreaming(
        text,
        draft.name,
        draft.examType || 'custom',
        token,
        (subject, index) => {
          subjectCount++
          dispatch({ type: 'APPEND_SUBJECT', subject: extractedToDraft(subject, index) })
          if (index === 0) {
            setProcessingState('streaming')
            dispatch({ type: 'SET_LANDSCAPE_SOURCE', source })
          }
        },
      )
      if (source === 'freetext' && isResearch) {
        dispatch({ type: 'SET_RESEARCH_QUESTION', question: text })
      }
      setProcessingState('idle')
    } catch (err) {
      if (subjectCount > 0) {
        setProcessingState('idle')
        toast.error(err instanceof Error ? err.message : 'Analysis incomplete')
      } else {
        setProcessingState('error')
        setError(err instanceof Error ? err.message : 'Extraction failed')
      }
    }
  }, [getToken, draft.name, draft.examType, isResearch, dispatch])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }, [handleFiles])

  // Loading states
  if (processingState === 'uploading') {
    return (
      <div className="max-w-2xl mx-auto glass-card p-8 text-center">
        <Loader2 className="w-10 h-10 text-[var(--accent-text)] mx-auto mb-4 animate-spin" />
        <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
          {t('dashboard.onboarding.uploading')}
        </h3>
        {batchProgress && batchProgress.results.length > 0 && (
          <div className="mt-4 space-y-1 max-w-sm mx-auto">
            {batchProgress.results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-[var(--text-body)]">
                <FileText className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                <span className="truncate">{r.fileName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (processingState === 'analyzing') {
    return (
      <div className="max-w-2xl mx-auto glass-card p-8 text-center">
        <div className="w-10 h-10 mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-full bg-[var(--accent-text)]/20 animate-ping" />
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

  if (processingState === 'error') {
    return (
      <div className="max-w-2xl mx-auto glass-card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
          {t('dashboard.onboarding.extractionError')}
        </h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">{error}</p>
        <button onClick={() => setProcessingState('idle')} className="btn-primary px-6 py-2">
          {t('dashboard.onboarding.retry')}
        </button>
      </div>
    )
  }

  // Research mode: different layout
  if (isResearch) {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">
          {t('wizard.landscapeTitle')}
        </h2>
        <p className="text-[var(--text-muted)] mb-6">
          {t('wizard.landscapeSubtitleResearch', 'Tell us about your research and we\'ll structure it for you')}
        </p>

        {!hasSubjects && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
                {t('wizard.researchQuestion', 'What\'s your research question?')}
              </label>
              <textarea
                value={freetextContent}
                onChange={e => setFreetextContent(e.target.value)}
                placeholder={t('wizard.researchQuestionPlaceholder')}
                rows={4}
                className="input-field w-full resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
                {t('wizard.researchStage')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Literature Review', 'Data Collection', 'Writing', 'Defending'].map(stage => (
                  <button
                    key={stage}
                    onClick={() => dispatch({ type: 'SET_RESEARCH_STAGE', stage })}
                    className={`glass-card p-3 text-sm text-left transition-all ${
                      draft.researchStage === stage
                        ? 'bg-[var(--accent-bg)] ring-1 ring-[var(--accent-text)]/30'
                        : 'hover:border-[var(--text-muted)]/30'
                    }`}
                    style={draft.researchStage === stage ? { borderColor: 'var(--accent-text)' } : undefined}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleTextExtract(freetextContent, 'freetext')}
              disabled={!freetextContent.trim()}
              className="btn-primary w-full py-2.5 disabled:opacity-40"
            >
              {t('wizard.analyzeResearch')}
            </button>
          </div>
        )}

        {hasSubjects && (
          <>
            {processingState === 'streaming' && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-sm text-[var(--accent-text)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('wizard.stillAnalyzing', 'Found {{count}} subject(s) — still analyzing...', { count: draft.subjects.length })}
              </div>
            )}
            <TopicMapEditor subjects={draft.subjects} dispatch={dispatch} />
            <div className="flex justify-between mt-6">
              <button onClick={onBack} className="btn-secondary px-4 py-2 flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> {t('common.back')}
              </button>
              <button
                onClick={onNext}
                disabled={!canContinue || processingState === 'streaming'}
                className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-40"
              >
                {t('common.next')} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {!hasSubjects && (
          <div className="flex justify-between mt-6">
            <button onClick={onBack} className="btn-secondary px-4 py-2 flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" /> {t('common.back')}
            </button>
            <button
              onClick={() => {
                dispatch({ type: 'SET_LANDSCAPE_SOURCE', source: 'manual' })
                dispatch({
                  type: 'ADD_SUBJECT',
                  subject: {
                    tempId: crypto.randomUUID(),
                    name: '',
                    weight: 100,
                    color: COLORS[0],
                    topics: [{ tempId: crypto.randomUUID(), name: '' }],
                  },
                })
              }}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
            >
              {t('wizard.buildManually')}
            </button>
          </div>
        )}
      </div>
    )
  }

  // Study mode: tabbed interface
  const tabs: { id: InputTab; label: string; icon: typeof Upload }[] = [
    { id: 'upload', label: t('wizard.tabUpload'), icon: Upload },
    { id: 'paste', label: t('wizard.tabPaste'), icon: FileText },
    { id: 'freetext', label: t('wizard.tabDescribe'), icon: Type },
    { id: 'manual', label: t('wizard.tabManual'), icon: PenTool },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">
        {t('wizard.landscapeTitle')}
      </h2>
      <p className="text-[var(--text-muted)] mb-6">
        {t('wizard.landscapeSubtitle', 'Tell us what you\'re studying — upload materials, describe it, or build from scratch')}
      </p>

      {/* Show tabs only when no subjects extracted yet */}
      {!hasSubjects && (
        <>
          <div className="flex gap-1 p-1 bg-[var(--bg-input)] rounded-xl mb-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[var(--bg-card)] text-[var(--text-heading)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Upload tab */}
          {activeTab === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={e => { e.preventDefault(); setIsDragOver(false) }}
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
                {t('wizard.uploadHint')}
              </p>
            </div>
          )}

          {/* Paste tab */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <textarea
                value={pasteContent}
                onChange={e => setPasteContent(e.target.value)}
                placeholder={t('wizard.pasteHint')}
                rows={8}
                className="input-field w-full resize-none"
              />
              <button
                onClick={() => handleTextExtract(pasteContent, 'paste')}
                disabled={!pasteContent.trim()}
                className="btn-primary w-full py-2.5 disabled:opacity-40"
              >
                {t('wizard.analyzeContent')}
              </button>
            </div>
          )}

          {/* Freetext tab */}
          {activeTab === 'freetext' && (
            <div className="space-y-4">
              <textarea
                value={freetextContent}
                onChange={e => setFreetextContent(e.target.value)}
                placeholder={t('wizard.freetextHint', 'Describe what you\'re studying in your own words. For example: "Constitutional law course covering separation of powers, federalism, individual rights..."')}
                rows={6}
                className="input-field w-full resize-none"
              />
              <button
                onClick={() => handleTextExtract(freetextContent, 'freetext')}
                disabled={!freetextContent.trim()}
                className="btn-primary w-full py-2.5 disabled:opacity-40"
              >
                {t('wizard.analyzeContent')}
              </button>
            </div>
          )}

          {/* Manual tab */}
          {activeTab === 'manual' && (
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-4">
                {t('wizard.manualHint')}
              </p>
              <button
                onClick={() => {
                  dispatch({ type: 'SET_LANDSCAPE_SOURCE', source: 'manual' })
                  dispatch({
                    type: 'ADD_SUBJECT',
                    subject: {
                      tempId: crypto.randomUUID(),
                      name: '',
                      weight: 100,
                      color: COLORS[0],
                      topics: [{ tempId: crypto.randomUUID(), name: '' }],
                    },
                  })
                }}
                className="btn-primary w-full py-2.5"
              >
                {t('wizard.startManual')}
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={e => handleFiles(Array.from(e.target.files ?? []))}
            className="hidden"
          />
        </>
      )}

      {/* TopicMapEditor: shown when subjects exist */}
      {hasSubjects && (
        <>
          {processingState === 'streaming' && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-sm text-[var(--accent-text)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              {`Found ${draft.subjects.length} subject${draft.subjects.length !== 1 ? 's' : ''} — still analyzing...`}
            </div>
          )}
          <TopicMapEditor subjects={draft.subjects} dispatch={dispatch} />
        </>
      )}

      <div className="flex justify-between mt-6">
        <button onClick={onBack} className="btn-secondary px-4 py-2 flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> {t('common.back')}
        </button>
        {hasSubjects ? (
          <button
            onClick={onNext}
            disabled={!canContinue || processingState === 'streaming'}
            className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-40"
          >
            {t('common.next')} <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => {
              dispatch({ type: 'SET_LANDSCAPE_SOURCE', source: 'manual' })
              dispatch({
                type: 'ADD_SUBJECT',
                subject: {
                  tempId: crypto.randomUUID(),
                  name: '',
                  weight: 100,
                  color: COLORS[0],
                  topics: [{ tempId: crypto.randomUUID(), name: '' }],
                },
              })
            }}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
          >
            {t('wizard.buildManually')}
          </button>
        )}
      </div>
    </div>
  )
}
