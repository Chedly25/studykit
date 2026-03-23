/**
 * React hook for the conversational onboarding flow.
 * Manages state persistence (sessionStorage) and DB action execution.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { db } from '../db'
import { getExamBlueprint } from '../lib/examTopicMaps'
import type { ExamType, Subject, Topic, Subtopic, Chapter } from '../db/schema'
import type { ExtractedSubject } from '../ai/topicExtractor'
import {
  createInitialState,
  processOnboardingInput,
  type OnboardingState,
  type OnboardingInput,
  type OnboardingAction,
} from '../ai/workflows/onboardingFlow'

const STORAGE_KEY = 'onboarding_state'

function loadState(): OnboardingState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveState(state: OnboardingState) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

export function useOnboarding() {
  const { userId, getToken } = useAuth()
  const effectiveUserId = userId ?? 'local'

  const [state, setState] = useState<OnboardingState>(() => loadState() ?? createInitialState())
  const stateRef = useRef(state)
  stateRef.current = state

  // Persist to sessionStorage on every change
  useEffect(() => { saveState(state) }, [state])

  const executeAction = useCallback(async (action: OnboardingAction, currentState: OnboardingState) => {
    const authToken = await getToken()

    switch (action.type) {
      case 'create-profile': {
        const { examName, examType, examDate } = action.payload as { examName: string; examType: ExamType; examDate: string }
        const blueprint = getExamBlueprint(examType)
        const profileId = crypto.randomUUID()

        await db.examProfiles.put({
          id: profileId,
          name: examName,
          examType,
          examDate: examDate || '',
          isActive: false, // Activated at completion
          passingThreshold: blueprint.defaultPassingThreshold,
          weeklyTargetHours: 15, // Updated in capacity step
          userId: effectiveUserId,
          createdAt: new Date().toISOString(),
          profileMode: 'study',
        })

        // Seed empty blueprint subjects (will be replaced by seed-topics if extraction happens)
        const today = new Date().toISOString().slice(0, 10)
        const subjects: Subject[] = []
        const chapters: Chapter[] = []
        const topics: Topic[] = []

        for (let si = 0; si < blueprint.subjects.length; si++) {
          const seed = blueprint.subjects[si]
          const subjectId = crypto.randomUUID()
          const chapterId = crypto.randomUUID()

          subjects.push({
            id: subjectId, examProfileId: profileId, name: seed.name,
            weight: seed.weight, mastery: 0, color: seed.color, order: si,
          })
          chapters.push({
            id: chapterId, subjectId, examProfileId: profileId, name: 'General', order: 0,
          })
          for (const seedTopic of seed.topics) {
            topics.push({
              id: crypto.randomUUID(), subjectId, chapterId, examProfileId: profileId,
              name: seedTopic.name, mastery: 0, confidence: 0,
              questionsAttempted: 0, questionsCorrect: 0,
              easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewDate: today,
            })
          }
        }

        if (subjects.length > 0) await db.subjects.bulkPut(subjects)
        if (chapters.length > 0) await db.chapters.bulkPut(chapters)
        if (topics.length > 0) await db.topics.bulkPut(topics)

        setState(prev => ({ ...prev, profileId }))
        return profileId
      }

      case 'seed-topics': {
        const profileId = currentState.profileId
        if (!profileId) break

        const extracted = action.payload.subjects as ExtractedSubject[]
        if (!extracted || extracted.length === 0) break

        const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4']

        // Clear existing blueprint data
        await db.subtopics.where('examProfileId').equals(profileId).delete()
        await db.topics.where('examProfileId').equals(profileId).delete()
        await db.chapters.where('examProfileId').equals(profileId).delete()
        await db.subjects.where('examProfileId').equals(profileId).delete()

        const equalShare = 100 / extracted.length
        const effectiveWeights = extracted.map(s => s.weight > 0 ? s.weight : equalShare)
        const totalWeight = effectiveWeights.reduce((s, w) => s + w, 0)
        const weightScale = 100 / totalWeight

        const subjects: Subject[] = []
        const allChapters: Chapter[] = []
        const allTopics: Topic[] = []
        const subtopics: Subtopic[] = []
        const today = new Date().toISOString().slice(0, 10)

        for (let si = 0; si < extracted.length; si++) {
          const ext = extracted[si]
          const subjectId = crypto.randomUUID()
          const chapters = ext.chapters && ext.chapters.length > 0
            ? ext.chapters
            : [{ name: 'General', topics: ext.topics }]

          subjects.push({
            id: subjectId, examProfileId: profileId, name: ext.name,
            weight: Math.round(effectiveWeights[si] * weightScale),
            mastery: 0, color: COLORS[si % COLORS.length], order: si,
          })

          for (let ci = 0; ci < chapters.length; ci++) {
            const ch = chapters[ci]
            const chapterId = crypto.randomUUID()
            allChapters.push({ id: chapterId, subjectId, examProfileId: profileId, name: ch.name, order: ci })

            for (const topic of ch.topics) {
              const topicId = crypto.randomUUID()
              allTopics.push({
                id: topicId, subjectId, chapterId, examProfileId: profileId,
                name: topic.name, mastery: 0, confidence: 0,
                questionsAttempted: 0, questionsCorrect: 0,
                easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewDate: today,
              })
              for (const st of topic.subtopics ?? []) {
                subtopics.push({ id: crypto.randomUUID(), topicId, examProfileId: profileId, name: st })
              }
            }
          }
        }

        await db.subjects.bulkPut(subjects)
        await db.chapters.bulkPut(allChapters)
        await db.topics.bulkPut(allTopics)
        if (subtopics.length > 0) await db.subtopics.bulkPut(subtopics)
        break
      }

      case 'update-student-model': {
        const profileId = currentState.profileId
        if (!profileId) break
        const { selfAssessment } = action.payload as { selfAssessment: { strong: string[]; weak: string[]; experience: string } }

        await db.studentModels.put({
          id: profileId,
          examProfileId: profileId,
          learningStyle: '{}',
          commonMistakes: '[]',
          personalityNotes: JSON.stringify([selfAssessment.experience]),
          preferredExplanations: '[]',
          motivationTriggers: '[]',
          updatedAt: new Date().toISOString(),
        })
        break
      }

      case 'generate-plan': {
        const profileId = currentState.profileId
        if (!profileId || !authToken) break

        const weeklyHours = (action.payload.weeklyHours as number) ?? 15
        await db.examProfiles.update(profileId, { weeklyTargetHours: weeklyHours })

        // Non-blocking plan generation
        import('../ai/studyPlanGenerator').then(({ generateStudyPlan }) => {
          generateStudyPlan(profileId, authToken, 7).catch(() => {})
        }).catch(() => {})
        break
      }
    }
  }, [effectiveUserId, getToken])

  const sendMessage = useCallback(async (input: OnboardingInput) => {
    setState(prev => ({ ...prev, isProcessing: true }))

    try {
      const currentState = stateRef.current
      const { newState, actions } = processOnboardingInput(input, currentState)

      // Execute actions sequentially
      let updatedState = newState
      for (const action of actions) {
        const result = await executeAction(action, updatedState)
        if (action.type === 'create-profile' && result) {
          updatedState = { ...updatedState, profileId: result as string }
        }
      }

      // Auto-detect known exam topics when entering materials step
      if (updatedState.step === 'materials' && !updatedState.topicsExtracted && !updatedState.materialsChoice) {
        try {
          const token = await getToken()
          if (token && updatedState.examName) {
            const { generateKnownExamLandscape } = await import('../ai/landscapeExtractor')
            const result = await generateKnownExamLandscape(updatedState.examName, updatedState.jurisdiction, token)
            if (result && result.subjects.length > 0) {
              // Auto-detected! Show preview instead of choice widget
              const { msg } = await import('../ai/workflows/onboardingFlow')
              const previewMsg = msg(
                'assistant',
                `I know the standard ${updatedState.examName} subjects. Here's what I've set up:`,
                { type: 'topic-preview', subjects: result.subjects },
              )
              updatedState = {
                ...updatedState,
                extractedSubjects: result.subjects,
                messages: [...updatedState.messages.slice(0, -1), previewMsg], // Replace the choice widget message
              }
            }
          }
        } catch {
          // Non-fatal — fall through to manual choice
        }
      }

      setState({ ...updatedState, isProcessing: false })
    } catch (err) {
      console.error('Onboarding error:', err)
      setState(prev => ({ ...prev, isProcessing: false }))
    }
  }, [executeAction, getToken])

  const completeOnboarding = useCallback(async () => {
    const profileId = state.profileId
    if (!profileId) return

    // Activate the profile
    await db.examProfiles.toCollection().modify({ isActive: false })
    await db.examProfiles.update(profileId, { isActive: true })

    // Auto-process any uploaded documents by enqueuing jobs directly to IndexedDB.
    // The app-level JobRunner (from BackgroundJobsProvider) picks up queued jobs automatically.
    try {
      const docs = await db.documents.where('examProfileId').equals(profileId).toArray()
      const unprocessed = docs.filter(d => !d.summary)
      const now = new Date().toISOString()
      for (const doc of unprocessed) {
        await db.backgroundJobs.put({
          id: crypto.randomUUID(),
          examProfileId: profileId,
          type: 'source-processing' as const,
          status: 'queued' as const,
          config: JSON.stringify({ documentId: doc.id, isPro: true }),
          completedStepIds: '[]',
          stepResults: '{}',
          totalSteps: 4,
          completedStepCount: 0,
          createdAt: now,
          updatedAt: now,
        })
      }
    } catch { /* non-blocking */ }

    // Clear onboarding state
    sessionStorage.removeItem(STORAGE_KEY)
  }, [state.profileId, getToken, effectiveUserId])

  const resetOnboarding = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setState(createInitialState())
  }, [])

  return { state, sendMessage, completeOnboarding, resetOnboarding }
}
