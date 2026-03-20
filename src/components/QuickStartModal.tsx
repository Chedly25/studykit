/**
 * Quick Start modal — lightweight 2-step onboarding.
 * Step 1: "What are you studying?" + optional exam date + optional PDF
 * Step 2: Streaming topic extraction → create profile → navigate to /queue
 */
import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Upload, Loader2, Sparkles, ArrowRight } from 'lucide-react'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { extractLandscapeFromText } from '../ai/landscapeExtractor'
import { useAuth } from '@clerk/clerk-react'

const SUBJECT_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1', '#F97316', '#14B8A6']

interface Props {
  open: boolean
  onClose: () => void
}

export function QuickStartModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { createProfile, setActiveProfile } = useExamProfile()
  const { getToken } = useAuth()

  const [step, setStep] = useState(1)
  const [description, setDescription] = useState('')
  const [examDate, setExamDate] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [streamingStatus, setStreamingStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setPdfFile(file)
  }, [])

  const handleStart = useCallback(async () => {
    if (!description.trim()) return
    setStep(2)
    setIsProcessing(true)
    setError(null)
    setStreamingStatus('Extracting topics...')

    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')

      // Extract text from PDF if uploaded
      let inputText = description
      if (pdfFile) {
        setStreamingStatus('Reading PDF...')
        const text = await pdfFile.text()
        inputText = `${description}\n\nCourse material content:\n${text.slice(0, 8000)}`
      }

      // Extract topics via AI
      setStreamingStatus('AI is analyzing your subject...')
      const profileName = description.slice(0, 60)
      const result = await extractLandscapeFromText(
        inputText,
        profileName,
        'university-course',
        token,
      )

      const subjects = result.subjects
      if (subjects.length === 0) {
        throw new Error('Could not extract topics. Try a more descriptive title.')
      }

      const topicCount = subjects.reduce((s, subj) => s + (subj.topics?.length ?? 0), 0)
      setStreamingStatus(`Found ${subjects.length} subjects, ${topicCount} topics...`)

      // Create profile
      setStreamingStatus('Creating your profile...')
      const profileId = await createProfile(
        profileName,
        'university-course',
        examDate || '',
        10,
        'study',
      )

      if (!profileId) throw new Error('Failed to create profile')

      // Seed subjects, chapters, and topics in bulk
      const today = new Date().toISOString().slice(0, 10)
      const allSubjects: Parameters<typeof db.subjects.bulkPut>[0] = []
      const allChapters: Parameters<typeof db.chapters.bulkPut>[0] = []
      const allTopics: Parameters<typeof db.topics.bulkPut>[0] = []

      for (let si = 0; si < subjects.length; si++) {
        const subj = subjects[si]
        const subjectId = crypto.randomUUID()
        const chapterId = crypto.randomUUID()

        allSubjects.push({
          id: subjectId,
          examProfileId: profileId,
          name: subj.name,
          weight: Math.round(100 / subjects.length),
          mastery: 0,
          color: SUBJECT_COLORS[si % SUBJECT_COLORS.length],
          order: si,
        })

        allChapters.push({
          id: chapterId,
          subjectId,
          examProfileId: profileId,
          name: 'General',
          order: 0,
        })

        for (const topic of subj.topics ?? []) {
          allTopics.push({
            id: crypto.randomUUID(),
            subjectId,
            examProfileId: profileId,
            chapterId,
            name: topic.name,
            mastery: 0,
            confidence: 0,
            questionsAttempted: 0,
            questionsCorrect: 0,
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReviewDate: today,
          })
        }
      }

      await db.subjects.bulkPut(allSubjects)
      await db.chapters.bulkPut(allChapters)
      await db.topics.bulkPut(allTopics)

      await setActiveProfile(profileId)
      setStreamingStatus('Ready! Redirecting...')

      setTimeout(() => {
        onClose()
        navigate('/queue')
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsProcessing(false)
    }
  }, [description, examDate, pdfFile, getToken, createProfile, setActiveProfile, navigate, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card p-6 max-w-md w-full mx-4 space-y-5 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-heading)]">
            {step === 1 ? 'Quick Start' : 'Setting up...'}
          </h2>
          {!isProcessing && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input)]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {step === 1 && (
          <>
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-heading)] mb-1.5">
                What are you studying?
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Organic Chemistry, AWS Solutions Architect..."
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-body)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
                autoFocus
              />
            </div>

            {/* Exam date (optional) */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Exam date (optional)
              </label>
              <input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-body)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
              />
            </div>

            {/* PDF drop zone (optional) */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Upload syllabus or notes (optional)
              </label>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-[var(--border-card)] text-sm text-[var(--text-muted)] hover:border-[var(--accent-text)] hover:text-[var(--accent-text)] transition-colors"
              >
                <Upload className="w-4 h-4" />
                {pdfFile ? pdfFile.name : 'Drop PDF here or click to browse'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.txt" onChange={handleFileChange} className="hidden" />
            </div>

            {/* Start */}
            <button
              onClick={handleStart}
              disabled={!description.trim()}
              className="w-full btn-primary py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              Generate Study Plan
            </button>
          </>
        )}

        {step === 2 && (
          <div className="text-center py-4 space-y-4">
            {isProcessing ? (
              <>
                <Loader2 className="w-10 h-10 text-[var(--accent-text)] animate-spin mx-auto" />
                <p className="text-sm text-[var(--text-muted)]">{streamingStatus}</p>
              </>
            ) : error ? (
              <>
                <p className="text-sm text-red-500">{error}</p>
                <button
                  onClick={() => { setStep(1); setError(null) }}
                  className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-2"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Try again
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
