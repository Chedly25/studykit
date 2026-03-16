import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { useExamProfile } from '../../../hooks/useExamProfile'
import { useSourceProcessing } from '../../../hooks/useSourceProcessing'
import { db } from '../../../db'
import type { ExtractionResult } from '../../../ai/topicExtractor'

type FamiliarityLevel = 'new' | 'some' | 'confident'

interface OnboardingAssessProps {
  examProfileId: string
  extractedData: ExtractionResult
  onComplete: () => void
}

export function OnboardingAssess({ examProfileId, extractedData, onComplete }: OnboardingAssessProps) {
  const { t } = useTranslation()
  const { seedTopicsForProfile } = useExamProfile()
  const { processDocument } = useSourceProcessing(examProfileId)
  const [assessments, setAssessments] = useState<Record<string, FamiliarityLevel>>({})
  const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(() => new Set([0]))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const setFamiliarity = useCallback((key: string, level: FamiliarityLevel) => {
    setAssessments(prev => ({ ...prev, [key]: level }))
  }, [])

  const toggleSubject = useCallback((idx: number) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  const handleContinue = useCallback(async () => {
    setIsSaving(true)
    setSaveError('')
    try {
      await seedTopicsForProfile(examProfileId, extractedData.subjects, assessments)

      // Fire document processing in background for concept mapping
      const docs = await db.documents.where('examProfileId').equals(examProfileId).toArray()
      for (const doc of docs) {
        processDocument(doc.id).catch(() => {})
      }

      onComplete()
    } catch (err) {
      setIsSaving(false)
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    }
  }, [examProfileId, extractedData, assessments, seedTopicsForProfile, processDocument, onComplete])

  const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4']

  if (saveError) {
    return (
      <div className="glass-card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
          {t('common.error')}
        </h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">{saveError}</p>
        <button onClick={() => setSaveError('')} className="btn-primary px-6 py-2">
          {t('dashboard.onboarding.retry')}
        </button>
      </div>
    )
  }

  if (isSaving) {
    return (
      <div className="glass-card p-8 text-center">
        <Loader2 className="w-10 h-10 text-[var(--accent-text)] mx-auto mb-4 animate-spin" />
        <h3 className="text-lg font-semibold text-[var(--text-heading)]">
          {t('dashboard.onboarding.saving')}
        </h3>
      </div>
    )
  }

  return (
    <div className="glass-card p-6">
      <h2 className="text-xl font-bold text-[var(--text-heading)] mb-1">
        {t('dashboard.onboarding.assessTitle')}
      </h2>
      <p className="text-sm text-[var(--text-muted)] mb-1">
        {t('dashboard.onboarding.assessSubtitle')}
      </p>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        {t('dashboard.onboarding.assessHint')}
      </p>

      <div className="space-y-3 mb-6">
        {extractedData.subjects.map((subject, si) => {
          const isExpanded = expandedSubjects.has(si)
          const color = COLORS[si % COLORS.length]

          return (
            <div key={si} className="border border-[var(--border-card)] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSubject(si)}
                className="w-full flex items-center gap-3 p-4 hover:bg-[var(--accent-bg)]/30 transition-colors"
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                )}
                <span className="font-semibold text-[var(--text-heading)] flex-1 text-left">{subject.name}</span>
                <span className="text-xs text-[var(--text-muted)]">{subject.topics.length} topics</span>
              </button>

              {isExpanded && (
                <div className="border-t border-[var(--border-card)] divide-y divide-[var(--border-card)]">
                  {subject.topics.map((topic, ti) => {
                    const key = `${si}-${ti}`
                    const level = assessments[key] ?? 'new'

                    return (
                      <div key={ti} className="flex items-center gap-3 p-3 px-4">
                        <span className="flex-1 text-sm text-[var(--text-body)]">{topic.name}</span>
                        <div className="flex gap-1">
                          {(['new', 'some', 'confident'] as const).map(l => (
                            <button
                              key={l}
                              onClick={() => setFamiliarity(key, l)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                level === l
                                  ? l === 'new'
                                    ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                    : l === 'some'
                                    ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
                                    : 'bg-green-500/15 text-green-600 dark:text-green-400'
                                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)]'
                              }`}
                            >
                              {t(`dashboard.onboarding.familiarity${l === 'new' ? 'New' : l === 'some' ? 'Some' : 'Confident'}`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={handleContinue}
        className="btn-primary w-full py-3 font-semibold"
      >
        {t('dashboard.onboarding.continue')}
      </button>
    </div>
  )
}
