/**
 * Exam DNA page — upload past papers, analyze style, view DNA profile.
 * Route: /exam-dna
 */
import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Upload, FileText, Dna, CheckCircle, ArrowRight, Loader2 } from 'lucide-react'
import { db } from '../../db'
import { useExamProfile } from '../../hooks/useExamProfile'
import { useSources } from '../../hooks/useSources'
import { useBackgroundJobs } from '../BackgroundJobsProvider'
import { SUBJECT_OPTIONS } from '../../ai/prompts/documentExamPrompts'
import type { DocumentExamSubject } from '../../ai/prompts/documentExamPrompts'
import type { DNAProfile } from '../../ai/prompts/examDNAPrompts'

export default function ExamDNAPage() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { uploadMultiplePdfs } = useSources(profileId)
  const { enqueue } = useBackgroundJobs()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [subject, setSubject] = useState<DocumentExamSubject>('maths-algebre')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Exam documents for this profile — show all exam docs
  // The user selects which subject they belong to via the dropdown before analyzing
  const examDocs = useLiveQuery(
    () => profileId
      ? db.documents.where('examProfileId').equals(profileId).filter(d => d.category === 'exam').toArray()
      : [],
    [profileId],
  ) ?? []

  // If DNA exists for this subject, only show docs that were used for it
  const relevantDocIds = currentDNA
    ? new Set(JSON.parse(currentDNA.sourceDocumentIds || '[]') as string[])
    : null

  // DNA profiles for this profile
  const dnaProfiles = useLiveQuery(
    () => profileId
      ? db.examDNA.where('examProfileId').equals(profileId).toArray()
      : [],
    [profileId],
  ) ?? []

  const currentDNA = dnaProfiles.find(d => d.subject === subject)
  let parsedDNA: DNAProfile | null = null
  try { if (currentDNA?.dnaProfile) parsedDNA = JSON.parse(currentDNA.dnaProfile) } catch { /* ignore */ }

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || !profileId) return
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf')
    if (pdfFiles.length > 0) {
      await uploadMultiplePdfs(pdfFiles, 'exam')
    }
  }, [profileId, uploadMultiplePdfs])

  const handleAnalyze = useCallback(async () => {
    if (!profileId || examDocs.length === 0) return
    setIsAnalyzing(true)
    try {
      await enqueue('exam-dna-analysis', profileId, {
        documentIds: examDocs.map(d => d.id),
        name: `${activeProfile?.name ?? 'Exam'} — ${SUBJECT_OPTIONS.find(s => s.value === subject)?.labelFr ?? subject}`,
        subject,
      }, 1)
    } finally {
      setIsAnalyzing(false)
    }
  }, [profileId, examDocs, subject, enqueue, activeProfile?.name])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      <Link to="/practice-exam" className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> {t('common.back')}
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[var(--accent-bg)] flex items-center justify-center">
          <Dna className="w-5 h-5 text-[var(--accent-text)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-heading)]">{t('examDNA.title')}</h1>
          <p className="text-xs text-[var(--text-muted)]">{t('examDNA.subtitle')}</p>
        </div>
      </div>

      {/* Subject selector */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-[var(--text-body)] mb-1">
          {t('examDNA.subject')}
        </label>
        <select
          value={subject}
          onChange={e => setSubject(e.target.value as DocumentExamSubject)}
          className="select-field w-full"
        >
          {SUBJECT_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.labelFr}</option>
          ))}
        </select>
      </div>

      {/* Upload zone */}
      <div
        className="glass-card p-6 mb-4 text-center cursor-pointer hover:border-[var(--accent-text)] transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); handleFileUpload(e.dataTransfer.files) }}
      >
        <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-sm text-[var(--text-body)]">{t('examDNA.dropHere')}</p>
        <p className="text-xs text-[var(--text-faint)] mt-1">{t('examDNA.dropHint')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={e => handleFileUpload(e.target.files)}
        />
      </div>

      {/* Uploaded papers list */}
      {examDocs.length > 0 && (
        <div className="glass-card p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-2">
            {t('examDNA.uploadedPapers')} ({examDocs.length})
          </p>
          <div className="space-y-1.5">
            {examDocs.map(doc => (
              <div key={doc.id} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-3.5 h-3.5 text-[var(--color-success)] shrink-0" />
                <span className="text-[var(--text-body)] truncate">{doc.title}</span>
                <span className="text-xs text-[var(--text-faint)] shrink-0">{doc.wordCount} words</span>
              </div>
            ))}
          </div>

          {/* Analyze button */}
          <p className="text-xs text-[var(--text-faint)] mt-2">
            {t('examDNA.analyzeHint', 'All papers above will be analyzed for the selected subject ({{subject}}).', {
              subject: SUBJECT_OPTIONS.find(s => s.value === subject)?.labelFr ?? subject,
            })}
          </p>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || examDocs.length === 0}
            className="btn-primary w-full py-2.5 text-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t('examDNA.analyzing')}</>
            ) : (
              <><Dna className="w-4 h-4" /> {t('examDNA.analyze', 'Analyze DNA from {{count}} papers', { count: examDocs.length })}</>
            )}
          </button>
        </div>
      )}

      {/* DNA Profile visualization */}
      {parsedDNA && currentDNA && (
        <div className="glass-card p-5 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-heading)] flex items-center gap-2">
              <Dna className="w-4 h-4 text-[var(--accent-text)]" />
              {t('examDNA.profileTitle')}
            </h2>
            <span className="text-xs text-[var(--text-faint)]">
              {t('examDNA.fromPapers', 'From {{count}} papers', { count: currentDNA.paperCount })}
            </span>
          </div>

          {/* Structure */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-1">{t('examDNA.structure')}</p>
            <p className="text-sm text-[var(--text-body)]">
              {parsedDNA.structure.partCount} {t('examDNA.parts')} · {parsedDNA.structure.totalQuestions} {t('examDNA.questions')}
              {parsedDNA.structure.hasTheoremTarget && ` · ${t('examDNA.theoremTarget')}`}
            </p>
          </div>

          {/* Question types */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-1.5">{t('examDNA.questionTypes')}</p>
            <div className="space-y-1">
              {Object.entries(parsedDNA.questionTypes)
                .filter(([, v]) => v > 0.03)
                .sort(([, a], [, b]) => b - a)
                .map(([type, pct]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--accent-text)]" style={{ width: `${Math.round(pct * 100)}%` }} />
                    </div>
                    <span className="text-xs text-[var(--text-body)]">{Math.round(pct * 100)}% {type}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-1">{t('examDNA.difficulty')}</p>
            <p className="text-sm text-[var(--text-body)]">
              {parsedDNA.difficulty.curveShape} · {parsedDNA.difficulty.scaffoldingLevel} {t('examDNA.scaffolding')}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {parsedDNA.difficulty.hintsCount} {t('examDNA.hints')} · {parsedDNA.difficulty.questionsWithoutHints} {t('examDNA.unguided')}
            </p>
          </div>

          {/* Domains */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-1">{t('examDNA.domains')}</p>
            <p className="text-sm text-[var(--text-body)]">
              {parsedDNA.content.primaryDomain}
              {parsedDNA.content.secondaryDomains.length > 0 && ` + ${parsedDNA.content.secondaryDomains.join(', ')}`}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {t('examDNA.theoremLevel')}: {parsedDNA.content.theoremLevel}
            </p>
          </div>

          {/* Sample patterns */}
          {parsedDNA.style.samplePatterns.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-1">{t('examDNA.patterns')}</p>
              <div className="space-y-1">
                {parsedDNA.style.samplePatterns.slice(0, 3).map((p, i) => (
                  <p key={i} className="text-xs text-[var(--text-muted)] italic">"{p}"</p>
                ))}
              </div>
            </div>
          )}

          {/* Generate from DNA */}
          <Link
            to="/practice-exam"
            className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" /> {t('examDNA.generateFromDNA')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
