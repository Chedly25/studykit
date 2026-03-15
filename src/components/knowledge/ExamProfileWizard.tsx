import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Calendar, Target, ChevronRight, ChevronLeft, BookOpen } from 'lucide-react'
import { useExamProfile } from '../../hooks/useExamProfile'
import type { ExamType } from '../../db/schema'
import { examBlueprints, getAllExamTypes } from '../../lib/examTopicMaps'

type Step = 'exam-type' | 'details' | 'review'

export function ExamProfileWizard() {
  const navigate = useNavigate()
  const { createProfile } = useExamProfile()

  const [step, setStep] = useState<Step>('exam-type')
  const [examType, setExamType] = useState<ExamType | null>(null)
  const [name, setName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [weeklyTarget, setWeeklyTarget] = useState(20)
  const [isCreating, setIsCreating] = useState(false)

  const blueprint = examType ? examBlueprints[examType] : null

  const handleCreate = async () => {
    if (!examType || !name || !examDate) return
    setIsCreating(true)
    try {
      await createProfile(name, examType, examDate, weeklyTarget)
      navigate('/dashboard')
    } catch (err) {
      console.error('Failed to create profile:', err)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {(['exam-type', 'details', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step === s ? 'bg-[var(--accent-text)] text-white' :
              (['exam-type', 'details', 'review'].indexOf(step) > i) ? 'bg-[var(--accent-text)]/20 text-[var(--accent-text)]' :
              'bg-[var(--bg-input)] text-[var(--text-muted)]'
            }`}>
              {i + 1}
            </div>
            {i < 2 && <div className="w-12 h-0.5 bg-[var(--border-card)]" />}
          </div>
        ))}
      </div>

      {/* Step 1: Exam Type */}
      {step === 'exam-type' && (
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">Choose Your Exam</h2>
          <p className="text-[var(--text-muted)] mb-6">Select the exam you're preparing for. We'll set up your knowledge graph with the official blueprint.</p>

          <div className="grid gap-3">
            {getAllExamTypes().map(type => {
              const bp = examBlueprints[type]
              return (
                <button
                  key={type}
                  onClick={() => {
                    setExamType(type)
                    if (type !== 'custom') setName(bp.label)
                  }}
                  className={`glass-card p-4 text-left transition-all ${
                    examType === type
                      ? 'border-[var(--accent-text)] ring-1 ring-[var(--accent-text)]/30'
                      : 'hover:border-[var(--text-muted)]/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-5 h-5 text-[var(--accent-text)]" />
                    <div>
                      <div className="font-semibold text-[var(--text-heading)]">{bp.label}</div>
                      <div className="text-sm text-[var(--text-muted)]">{bp.description}</div>
                    </div>
                  </div>
                  {type !== 'custom' && (
                    <div className="mt-2 text-xs text-[var(--text-faint)]">
                      {bp.subjects.length} subjects &middot; {bp.subjects.reduce((s, sub) => s + sub.topics.length, 0)} topics
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setStep('details')}
              disabled={!examType}
              className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 'details' && (
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">Exam Details</h2>
          <p className="text-[var(--text-muted)] mb-6">Set your exam date and weekly study target.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">Profile Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., July 2026 Bar Exam"
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Exam Date
              </label>
              <input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
                <Target className="w-4 h-4 inline mr-1" />
                Weekly Study Target (hours)
              </label>
              <input
                type="range"
                min={5}
                max={60}
                value={weeklyTarget}
                onChange={e => setWeeklyTarget(Number(e.target.value))}
                className="w-full accent-[var(--accent-text)]"
              />
              <div className="text-center text-lg font-semibold text-[var(--accent-text)]">{weeklyTarget}h / week</div>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep('exam-type')} className="btn-secondary px-4 py-2 flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={!name || !examDate}
              className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && blueprint && (
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">Review & Create</h2>
          <p className="text-[var(--text-muted)] mb-6">Here's what we'll set up for you.</p>

          <div className="glass-card p-4 space-y-3 mb-4">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Exam</span>
              <span className="font-medium text-[var(--text-heading)]">{name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Date</span>
              <span className="font-medium text-[var(--text-heading)]">{examDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Weekly Target</span>
              <span className="font-medium text-[var(--text-heading)]">{weeklyTarget}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Passing Threshold</span>
              <span className="font-medium text-[var(--text-heading)]">{blueprint.defaultPassingThreshold}%</span>
            </div>
          </div>

          {examType !== 'custom' && (
            <div className="glass-card p-4 mb-4">
              <h3 className="font-semibold text-[var(--text-heading)] mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Subjects ({blueprint.subjects.length})
              </h3>
              <div className="space-y-2">
                {blueprint.subjects.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[var(--text-body)]">{s.name}</span>
                    </div>
                    <span className="text-[var(--text-muted)]">
                      {s.weight}% &middot; {s.topics.length} topics
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep('details')} className="btn-secondary px-4 py-2 flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="btn-primary px-6 py-2 disabled:opacity-60"
            >
              {isCreating ? 'Creating...' : 'Create Profile'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExamProfileWizard
