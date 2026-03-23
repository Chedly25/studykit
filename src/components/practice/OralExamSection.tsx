/**
 * Oral exam section — TTS reads questions, student speaks answers.
 * Sequential: question → prep countdown → record → transcribe → next.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, MicOff, Loader2, Volume2, SkipForward, ArrowRight } from 'lucide-react'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { useVoiceOutput } from '../../hooks/useVoiceOutput'
import { db } from '../../db'
import type { GeneratedQuestion } from '../../db/schema'
import { MathText } from '../MathText'

interface Props {
  questions: GeneratedQuestion[]
  prepTimePerQuestion: number // seconds
  onComplete: () => void
  examProfileId?: string
}

type Phase = 'presenting' | 'preparing' | 'recording' | 'transcribing' | 'done'

export function OralExamSection({ questions, prepTimePerQuestion, onComplete, examProfileId: _examProfileId }: Props) {
  const { t } = useTranslation()
  const [currentIdx, setCurrentIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('presenting')
  const [prepRemaining, setPrepRemaining] = useState(prepTimePerQuestion)
  const [transcript, setTranscript] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionStartRef = useRef(Date.now())

  const voiceInput = useVoiceInput(300_000) // 5 min max for oral
  const voiceOutput = useVoiceOutput()

  const currentQ = questions[currentIdx]

  // Present question via TTS
  useEffect(() => {
    if (phase !== 'presenting' || !currentQ) return
    questionStartRef.current = Date.now()
    setTranscript('')
    voiceOutput.speak(currentQ.text)
    // Auto-transition to prep after a short delay (or TTS finishes)
    const timer = setTimeout(() => setPhase('preparing'), 3000)
    return () => clearTimeout(timer)
  }, [currentIdx, phase])

  // Prep countdown
  useEffect(() => {
    if (phase !== 'preparing') return
    setPrepRemaining(prepTimePerQuestion)
    timerRef.current = setInterval(() => {
      setPrepRemaining(prev => {
        if (prev <= 1) {
          setPhase('recording')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, prepTimePerQuestion])

  // Auto-start recording when entering recording phase
  useEffect(() => {
    if (phase === 'recording' && !voiceInput.isRecording && !voiceInput.isTranscribing) {
      voiceInput.startRecording()
    }
  }, [phase, voiceInput.isRecording, voiceInput.isTranscribing])

  const handleStopRecording = useCallback(async () => {
    const text = await voiceInput.stopRecording()
    setPhase('transcribing')
    if (text) {
      setTranscript(text)
      // Save answer + timing
      const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000)
      if (currentQ) {
        await db.generatedQuestions.update(currentQ.id, {
          userAnswer: text,
          isAnswered: true,
          timeSpentSeconds: timeSpent,
        })
      }
    }
    setPhase('done')
  }, [currentQ, voiceInput])

  const handleNext = useCallback(() => {
    if (currentIdx + 1 >= questions.length) {
      onComplete()
    } else {
      setCurrentIdx(prev => prev + 1)
      setPhase('presenting')
    }
  }, [currentIdx, questions.length, onComplete])

  const handleSkipPrep = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setPhase('recording')
  }

  if (!currentQ) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-[var(--text-muted)]">{t('practiceExam.oralComplete', 'Oral section complete')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Question counter */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{t('practiceExam.questionOf', { current: currentIdx + 1, total: questions.length })}</span>
        <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" /> {t('practiceExam.oralExam', 'Oral Exam')}</span>
      </div>

      {/* Question text */}
      <div className="glass-card p-5">
        <p className="text-sm text-[var(--text-body)] leading-relaxed">
          <MathText>{currentQ.text}</MathText>
        </p>
      </div>

      {/* Phase UI */}
      {phase === 'presenting' && (
        <div className="text-center py-4">
          <Volume2 className="w-6 h-6 text-[var(--accent-text)] mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-[var(--text-muted)]">{t('practiceExam.readingQuestion', 'Reading question aloud...')}</p>
        </div>
      )}

      {phase === 'preparing' && (
        <div className="text-center py-4 space-y-3">
          <div className="text-3xl font-mono font-bold text-[var(--text-heading)]">
            {Math.floor(prepRemaining / 60)}:{String(prepRemaining % 60).padStart(2, '0')}
          </div>
          <p className="text-sm text-[var(--text-muted)]">{t('practiceExam.prepTime', 'Preparation time — think about your answer')}</p>
          <button onClick={handleSkipPrep} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 mx-auto">
            <SkipForward className="w-3 h-3" /> {t('practiceExam.skipPrep', 'Skip prep')}
          </button>
        </div>
      )}

      {phase === 'recording' && (
        <div className="text-center py-4 space-y-3">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto animate-pulse">
            <Mic className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-sm font-medium text-red-500">{t('practiceExam.recording', 'Recording your answer...')}</p>
          <button onClick={handleStopRecording} className="btn-primary text-sm px-6 py-2 flex items-center gap-2 mx-auto">
            <MicOff className="w-4 h-4" /> {t('practiceExam.stopRecording', 'Stop recording')}
          </button>
        </div>
      )}

      {phase === 'transcribing' && (
        <div className="text-center py-4">
          <Loader2 className="w-6 h-6 text-[var(--accent-text)] mx-auto mb-2 animate-spin" />
          <p className="text-sm text-[var(--text-muted)]">{t('practiceExam.transcribing', 'Transcribing...')}</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-3">
          {transcript ? (
            <div className="glass-card p-4">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-1">{t('practiceExam.yourAnswer', 'Your answer:')}</p>
              <p className="text-sm text-[var(--text-body)]">{transcript}</p>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] text-center">{t('practiceExam.noAnswer', 'No answer recorded')}</p>
          )}
          <button onClick={handleNext} className="btn-primary text-sm px-6 py-2 flex items-center gap-2 mx-auto">
            {currentIdx + 1 >= questions.length ? t('practiceExam.finishSection', 'Finish section') : t('common.next', 'Next')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
