import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BarChart3, Play, Clock, Sparkles, X, Shield, Settings2, FileText, Scale } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import type { Subject, Topic } from '../../db/schema'
import { SourcesToggle } from '../sources/SourcesToggle'
import { ExamFormatEditor } from '../knowledge/ExamFormatEditor'
import type { PracticeExamOptions } from '../../hooks/usePracticeExam'
import { CONCOURS_OPTIONS, SUBJECT_OPTIONS } from '../../ai/prompts/documentExamPrompts'
import type { DocumentExamSubject, ConcoursType } from '../../ai/prompts/documentExamPrompts'
import { SPECIALTY_OPTIONS } from '../../ai/prompts/casPratiquePrompts'
import type { CasPratiqueSpecialty } from '../../ai/prompts/casPratiquePrompts'

type ExamCategory = 'cpge' | 'crfpa' | 'medical' | 'general'

function detectExamCategory(profileName: string): ExamCategory {
  const lower = profileName.toLowerCase()
  if (/cpge|mines|polytechnique|centrale|ccinp|ccp|concours|mp\b|pc\b|psi\b|prépa/i.test(lower)) return 'cpge'
  if (/crfpa|barreau|avocat|droit des obligations|note de synth/i.test(lower)) return 'crfpa'
  if (/usmle|ecni?|médecine|medicine|nclex|step\s*[123]/i.test(lower)) return 'medical'
  return 'general'
}

interface PracticeExamSetupProps {
  examProfileId: string
  profileName?: string
  subjects: Subject[]
  topics: Topic[]
  weakTopics: Topic[]
  documentCount: number
  onStart: (options: PracticeExamOptions) => void
}

export function PracticeExamSetup({
  examProfileId,
  profileName,
  subjects,
  topics,
  weakTopics,
  documentCount,
  onStart,
}: PracticeExamSetupProps) {
  const { t } = useTranslation()
  const examCategory = detectExamCategory(profileName ?? '')
  const [questionCount, setQuestionCount] = useState(10)
  const [focusSubject, setFocusSubject] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [customFocus, setCustomFocus] = useState('')
  const [examSection, setExamSection] = useState('')
  const [sourcesEnabled, setSourcesEnabled] = useState(false)
  const hasUserToggledSources = useRef(false)

  useEffect(() => {
    hasUserToggledSources.current = false
  }, [examProfileId])

  useEffect(() => {
    if (!hasUserToggledSources.current && documentCount > 0) {
      setSourcesEnabled(true)
    }
  }, [documentCount])

  const handleToggleSources = (v: boolean) => {
    hasUserToggledSources.current = true
    setSourcesEnabled(v)
  }

  const [showFormatEditor, setShowFormatEditor] = useState(false)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(30)
  const [proctorMode, setProctorMode] = useState(false)

  // Document exam (Type B — CPGE)
  const [showDocumentExam, setShowDocumentExam] = useState(false)
  const [docConcours, setDocConcours] = useState<ConcoursType>('mines')
  const [docSubject, setDocSubject] = useState<DocumentExamSubject>('maths-algebre')

  // Cas pratique (CRFPA)
  const [showCasPratique, setShowCasPratique] = useState(false)
  const [cpSpecialty, setCpSpecialty] = useState<CasPratiqueSpecialty>('obligations')

  const examFormats = useLiveQuery(
    () => db.examFormats.where('examProfileId').equals(examProfileId).toArray(),
    [examProfileId],
  ) ?? []

  // Topics for the selected subject (or all if none selected)
  const availableTopics = useMemo(() => {
    if (!focusSubject) return topics
    const subject = subjects.find(s => s.name === focusSubject)
    return subject ? topics.filter(t => t.subjectId === subject.id) : topics
  }, [focusSubject, subjects, topics])

  const toggleTopic = (topicName: string) => {
    setSelectedTopics(prev =>
      prev.includes(topicName)
        ? prev.filter(t => t !== topicName)
        : [...prev, topicName]
    )
  }

  const addWeakTopics = () => {
    const weakNames = weakTopics.slice(0, 5).map(t => t.name)
    setSelectedTopics(prev => {
      const combined = new Set([...prev, ...weakNames])
      return Array.from(combined)
    })
  }

  const handleStart = () => {
    onStart({
      questionCount,
      focusSubject: focusSubject || undefined,
      selectedTopics: selectedTopics.length > 0 ? selectedTopics : undefined,
      customFocus: customFocus.trim() || undefined,
      examSection: examSection || undefined,
      sourcesEnabled,
      timeLimitSeconds: timerEnabled ? timerMinutes * 60 : undefined,
      proctorMode: proctorMode || undefined,
    })
  }

  const estimatedCalls = 3

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="text-center mb-8">
        <BarChart3 className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('ai.practiceSession')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.practiceSubtitle')}</p>
      </div>

      <div className="glass-card p-6 space-y-5">
        {/* Custom focus — free text for specific requests */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
            {t('practiceExam.customFocus')}
          </label>
          <input
            type="text"
            value={customFocus}
            onChange={e => setCustomFocus(e.target.value)}
            placeholder={t('practiceExam.customFocusPlaceholder')}
            className="input-field w-full"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {t('practiceExam.customFocusHint')}
          </p>
        </div>

        {/* Question count */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
            {t('ai.numberOfQuestions')}
          </label>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={questionCount}
            onChange={e => setQuestionCount(Number(e.target.value))}
            className="w-full accent-[var(--accent-text)]"
          />
          <div className="text-center text-lg font-semibold text-[var(--accent-text)]">{questionCount}</div>
        </div>

        {/* Focus area — subject level */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
            {t('ai.focusArea')}
          </label>
          <select
            value={focusSubject}
            onChange={e => { setFocusSubject(e.target.value); setSelectedTopics([]) }}
            className="select-field w-full"
          >
            <option value="">{t('ai.autoWeakest')}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.name}>{s.name} — {Math.round(s.mastery * 100)}%</option>
            ))}
          </select>
        </div>

        {/* Topic selection — pills */}
        {availableTopics.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--text-body)]">
                {t('practiceExam.selectTopics')}
              </label>
              {selectedTopics.length > 0 && (
                <button
                  onClick={() => setSelectedTopics([])}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                >
                  {t('practiceExam.clearSelection')}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTopics.map(topic => {
                const isSelected = selectedTopics.includes(topic.name)
                const isWeak = weakTopics.some(w => w.id === topic.id)
                return (
                  <button
                    key={topic.id}
                    onClick={() => toggleTopic(topic.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[var(--accent-text)] text-white'
                        : isWeak
                        ? 'border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:border-[var(--color-warning-border)]'
                        : 'border border-[var(--border-card)] bg-[var(--bg-input)] text-[var(--text-body)] hover:border-[var(--text-muted)]'
                    }`}
                  >
                    {topic.name}
                    {isSelected && <X className="inline w-3 h-3 ml-1" />}
                    {!isSelected && isWeak && <span className="ml-1 opacity-60">{Math.round(topic.mastery * 100)}%</span>}
                  </button>
                )
              })}
            </div>
            {selectedTopics.length > 0 && (
              <p className="text-xs text-[var(--accent-text)] mt-1.5">
                {t('practiceExam.topicsSelected', { count: selectedTopics.length })}
              </p>
            )}
          </div>
        )}

        {/* AI suggestions — weak topics quick-add */}
        {weakTopics.length > 0 && selectedTopics.length === 0 && !customFocus && (
          <button
            onClick={addWeakTopics}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-[var(--accent-text)]/30 text-sm text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {t('practiceExam.suggestWeakTopics', {
              topics: weakTopics.slice(0, 3).map(t => t.name).join(', ')
            })}
          </button>
        )}

        {/* Exam format section */}
        {examFormats.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-[var(--text-body)]">
                {t('examFormat.title')}
              </label>
              <button
                onClick={() => setShowFormatEditor(true)}
                className="text-xs text-[var(--accent-text)] hover:underline flex items-center gap-1"
              >
                <Settings2 className="w-3 h-3" /> {t('examFormat.editFormat')}
              </button>
            </div>
            <select
              value={examSection}
              onChange={e => setExamSection(e.target.value)}
              className="select-field w-full"
            >
              <option value="">All sections</option>
              {examFormats.map(f => (
                <option key={f.id} value={f.formatName}>{f.formatName} — {f.pointWeight}%</option>
              ))}
            </select>
          </div>
        ) : (
          <button
            onClick={() => setShowFormatEditor(true)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-[var(--accent-text)]/30 text-left hover:bg-[var(--accent-bg)] transition-colors"
          >
            <Settings2 className="w-5 h-5 text-[var(--accent-text)] shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">{t('practiceExam.configureExamFormat', 'Configure Exam Format')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('practiceExam.configureExamFormatHint', 'Define sections to unlock full exam simulation with per-section timers and instructions')}</p>
            </div>
          </button>
        )}

        <ExamFormatEditor
          open={showFormatEditor}
          onClose={() => setShowFormatEditor(false)}
          examProfileId={examProfileId}
        />

        {/* Sources toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--text-body)]">{t('ai.useSources')}</label>
          <SourcesToggle enabled={sourcesEnabled} onToggle={handleToggleSources} documentCount={documentCount} />
        </div>

        {/* Timer */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--text-body)] flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('practiceExam.timer')}
          </label>
          <button
            onClick={() => setTimerEnabled(!timerEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              timerEnabled ? 'bg-[var(--accent-text)]' : 'bg-[var(--bg-input)] border border-[var(--border-card)]'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              timerEnabled ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>

        {timerEnabled && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
              {t('practiceExam.timerDuration')}
            </label>
            <select
              value={timerMinutes}
              onChange={e => setTimerMinutes(Number(e.target.value))}
              className="select-field w-full"
            >
              {[10, 15, 20, 30, 45, 60, 90, 120].map(m => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
        )}

        {/* Proctor Mode */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-[var(--text-body)] flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {t('practiceExam.proctorMode')}
            </label>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('practiceExam.proctorModeHint')}
            </p>
          </div>
          <button
            onClick={() => setProctorMode(!proctorMode)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              proctorMode ? 'bg-[var(--accent-text)]' : 'bg-[var(--bg-input)] border border-[var(--border-card)]'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              proctorMode ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>

        {/* API usage estimate */}
        <div className="text-xs text-[var(--text-muted)] text-center">
          {t('practiceExam.estimatedCalls', { count: estimatedCalls })}
        </div>

        {/* Start buttons */}
        <div className="space-y-2">
          <button onClick={handleStart} className="btn-primary px-6 py-2.5 w-full flex items-center justify-center gap-2">
            <Play className="w-4 h-4" /> {t('ai.startPractice')}
          </button>

          {/* Simulation mode — uses exam format sections for a full exam experience */}
          {examFormats.length > 0 && (
            <button
              onClick={() => {
                const sections = examFormats
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map(f => ({
                    examFormatId: f.id,
                    formatName: f.formatName,
                    sectionType: (f.sectionType ?? 'written') as 'written' | 'oral' | 'practical',
                    timeAllocationMinutes: f.timeAllocation,
                    questionCount: f.questionCount ?? 10,
                    pointWeight: f.pointWeight,
                    questionFormat: f.questionFormat,
                    samplePrompt: f.samplePrompt,
                    prepTimeMinutes: f.prepTimeMinutes,
                    instructions: f.instructions,
                    shuffleQuestions: f.shuffleQuestions,
                    canGoBack: f.canGoBack,
                  }))
                const totalQuestions = sections.reduce((s, sec) => s + sec.questionCount, 0)
                onStart({
                  questionCount: totalQuestions,
                  sourcesEnabled,
                  proctorMode: proctorMode || undefined,
                  simulationMode: true,
                  sections,
                })
              }}
              className="btn-secondary px-6 py-2.5 w-full flex items-center justify-center gap-2 border-2 border-[var(--accent-text)]/30"
            >
              <Shield className="w-4 h-4" /> {t('practiceExam.startSimulation', 'Start Full Exam Simulation')}
            </button>
          )}

          {/* CPGE: Document Exam */}
          {(examCategory === 'cpge' || examCategory === 'general') && (
            <>
              <button
                onClick={() => setShowDocumentExam(!showDocumentExam)}
                className="btn-secondary px-6 py-2.5 w-full flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" /> {t('documentExam.startDocument', 'Document Exam (CPGE)')}
              </button>
              <Link
                to="/exam-dna"
                className="btn-ghost px-6 py-2 w-full flex items-center justify-center gap-2 text-sm"
              >
                {t('examDNA.setupDNA', 'Exam DNA — match real paper style')}
              </Link>
            </>
          )}
        </div>

        {/* CRFPA exam types */}
        {(examCategory === 'crfpa' || examCategory === 'general') && (
          <div className="space-y-2">
            {examCategory === 'crfpa' && (
              <p className="text-xs text-[var(--text-faint)] uppercase tracking-wider font-semibold px-1">CRFPA</p>
            )}
            <button
              onClick={() => {
                onStart({
                  questionCount: 0,
                  sourcesEnabled,
                  examMode: 'synthesis',
                  timeLimitSeconds: 5 * 3600,
                })
              }}
              className="btn-secondary px-6 py-2.5 w-full flex items-center justify-center gap-2"
            >
              <Scale className="w-4 h-4" /> {t('syntheseExam.startSynthese', 'Note de Synthèse')}
            </button>

            <button
              onClick={() => setShowCasPratique(!showCasPratique)}
              className="btn-secondary px-6 py-2.5 w-full flex items-center justify-center gap-2"
            >
              <Scale className="w-4 h-4" /> {t('casPratique.start', 'Cas Pratique / Consultation')}
            </button>

            {showCasPratique && (
              <div className="space-y-3 p-4 rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)]">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-body)] mb-1">
                    {t('casPratique.specialty', 'Specialty')}
                  </label>
                  <select
                    value={cpSpecialty}
                    onChange={e => setCpSpecialty(e.target.value as CasPratiqueSpecialty)}
                    className="select-field w-full"
                  >
                    <optgroup label="Tronc commun">
                      {SPECIALTY_OPTIONS.filter(s => s.category === 'obligations').map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Spécialité">
                      {SPECIALTY_OPTIONS.filter(s => s.category === 'specialite').map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Procédure">
                      {SPECIALTY_OPTIONS.filter(s => s.category === 'procedure').map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <button
                  onClick={() => {
                    const durations: Record<string, number> = {
                      obligations: 3 * 3600,
                      'procedure-civile': 2 * 3600, 'procedure-penale': 2 * 3600, 'procedure-administrative': 2 * 3600,
                    }
                    onStart({
                      questionCount: 0,
                      sourcesEnabled,
                      examMode: 'cas-pratique',
                      documentSubject: cpSpecialty,
                      timeLimitSeconds: durations[cpSpecialty] ?? 3 * 3600,
                    })
                  }}
                  className="btn-primary px-6 py-2.5 w-full flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> {t('casPratique.generate', 'Generate')}
                </button>
              </div>
            )}

            <button
              onClick={() => {
                onStart({
                  questionCount: 0,
                  sourcesEnabled: false,
                  examMode: 'grand-oral',
                  timeLimitSeconds: 3600,
                })
              }}
              className="btn-secondary px-6 py-2.5 w-full flex items-center justify-center gap-2"
            >
              <Scale className="w-4 h-4" /> {t('grandOral.start', 'Grand Oral')}
            </button>
          </div>
        )}

        {/* Document exam configuration panel (CPGE only) */}
        {showDocumentExam && (examCategory === 'cpge' || examCategory === 'general') && (
          <div className="space-y-3 p-4 rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)]">
            <h3 className="text-sm font-semibold text-[var(--text-heading)]">
              {t('documentExam.configTitle', 'Document Exam Configuration')}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {t('documentExam.configHint', 'Generates a full concours-style problem document with LaTeX — one continuous exam, not individual questions.')}
            </p>

            {/* Concours selector */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-body)] mb-1">
                {t('documentExam.concours', 'Concours')}
              </label>
              <select
                value={docConcours}
                onChange={e => setDocConcours(e.target.value as ConcoursType)}
                className="select-field w-full"
              >
                {CONCOURS_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Subject selector */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-body)] mb-1">
                {t('documentExam.subject', 'Subject')}
              </label>
              <select
                value={docSubject}
                onChange={e => setDocSubject(e.target.value as DocumentExamSubject)}
                className="select-field w-full"
              >
                {SUBJECT_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.labelFr}</option>
                ))}
              </select>
            </div>

            {/* Generate button */}
            <button
              onClick={() => {
                // Duration based on concours
                const durations: Record<ConcoursType, number> = {
                  polytechnique: 4 * 3600,
                  mines: 3 * 3600,
                  centrale: 4 * 3600,
                  ccinp: 3 * 3600,
                }
                onStart({
                  questionCount: 0, // will be computed from generated document
                  sourcesEnabled,
                  examMode: 'document',
                  documentSubject: docSubject,
                  documentConcours: docConcours,
                  timeLimitSeconds: durations[docConcours],
                })
              }}
              className="btn-primary px-6 py-2.5 w-full flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" /> {t('documentExam.generate', 'Generate Document Exam')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
