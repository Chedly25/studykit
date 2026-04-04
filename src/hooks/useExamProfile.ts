import { useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ExamProfile, ExamType, Subject, Topic, Subtopic, ProfileMode } from '../db/schema'
import { getExamBlueprint } from '../lib/examTopicMaps'
import type { ExtractedSubject } from '../ai/topicExtractor'

export function useExamProfile() {
  const { userId } = useAuth()
  const effectiveUserId = userId ?? 'local'

  const profilesRaw = useLiveQuery(
    () => db.examProfiles.where('userId').equals(effectiveUserId).toArray(),
    [effectiveUserId]
  )
  const profiles = profilesRaw ?? []
  const profilesLoaded = profilesRaw !== undefined
  const activeProfile = useLiveQuery(
    () => db.examProfiles.where('userId').equals(effectiveUserId).toArray()
      .then(all => all.find(p => p.isActive)),
    [effectiveUserId]
  )

  const createProfile = useCallback(async (
    name: string,
    examType: ExamType,
    examDate: string,
    weeklyTargetHours: number,
    profileMode?: ProfileMode
  ): Promise<string> => {
    const blueprint = getExamBlueprint(examType)
    const profileId = crypto.randomUUID()

    // Deactivate all existing profiles for this user
    await db.examProfiles.where('userId').equals(effectiveUserId).modify({ isActive: false })

    // Create the profile
    const profile: ExamProfile = {
      id: profileId,
      name,
      examType,
      examDate,
      isActive: true,
      passingThreshold: blueprint.defaultPassingThreshold,
      weeklyTargetHours,
      userId: effectiveUserId,
      createdAt: new Date().toISOString(),
      profileMode: profileMode ?? 'study',
    }
    await db.examProfiles.put(profile)

    // Seed subjects, topics, subtopics
    const subjects: Subject[] = []
    const topics: Topic[] = []
    const subtopics: Subtopic[] = []
    const today = new Date().toISOString().slice(0, 10)

    const chapters: import('../db/schema').Chapter[] = []

    for (let si = 0; si < blueprint.subjects.length; si++) {
      const seedSubj = blueprint.subjects[si]
      const subjectId = crypto.randomUUID()
      const chapterId = crypto.randomUUID()

      subjects.push({
        id: subjectId,
        examProfileId: profileId,
        name: seedSubj.name,
        weight: seedSubj.weight,
        mastery: 0,
        color: seedSubj.color,
        order: si,
      })

      // Create default chapter for this subject
      chapters.push({
        id: chapterId,
        subjectId,
        examProfileId: profileId,
        name: 'General',
        order: 0,
      })

      for (const seedTopic of seedSubj.topics) {
        const topicId = crypto.randomUUID()

        topics.push({
          id: topicId,
          subjectId,
          chapterId,
          examProfileId: profileId,
          name: seedTopic.name,
          mastery: 0,
          confidence: 0,
          questionsAttempted: 0,
          questionsCorrect: 0,
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReviewDate: today,
        })

        for (const stName of seedTopic.subtopics ?? []) {
          subtopics.push({
            id: crypto.randomUUID(),
            topicId,
            examProfileId: profileId,
            name: stName,
          })
        }
      }
    }

    await db.subjects.bulkPut(subjects)
    await db.chapters.bulkPut(chapters)
    await db.topics.bulkPut(topics)
    await db.subtopics.bulkPut(subtopics)

    // Seed CRFPA starter exercises if profile name contains CRFPA-related keywords
    if (/crfpa|barreau|avocat/i.test(name)) {
      try {
        const { CRFPA_EXERCISES } = await import('../db/seed/crfpa')
        const sourceId = crypto.randomUUID()
        await db.examSources.put({
          id: sourceId,
          examProfileId: profileId,
          documentId: '',
          name: 'CRFPA Starter Exercises',
          year: new Date().getFullYear(),
          totalExercises: CRFPA_EXERCISES.length,
          parsedAt: new Date().toISOString(),
        })
        const topicLookup = new Map(topics.map(t => [t.name.toLowerCase(), t.id]))
        const today = new Date().toISOString().slice(0, 10)
        await db.exercises.bulkPut(
          CRFPA_EXERCISES.map((ex, i) => ({
            id: crypto.randomUUID(),
            examSourceId: sourceId,
            examProfileId: profileId,
            exerciseNumber: i + 1,
            text: ex.text,
            solutionText: ex.solutionText,
            difficulty: ex.difficulty,
            points: undefined,
            topicIds: JSON.stringify(
              [...topicLookup.entries()]
                .filter(([name]) => name.includes(ex.topicName.toLowerCase()))
                .map(([, id]) => id)
            ),
            status: 'not_attempted' as const,
            attemptCount: 0,
            createdAt: new Date().toISOString(),
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReviewDate: today,
          }))
        )
      } catch { /* non-critical — seed failure shouldn't block profile creation */ }
    }

    return profileId
  }, [effectiveUserId])

  const setActiveProfile = useCallback(async (profileId: string) => {
    await db.examProfiles.where('userId').equals(effectiveUserId).modify({ isActive: false })
    await db.examProfiles.update(profileId, { isActive: true })
  }, [effectiveUserId])

  const seedTopicsForProfile = useCallback(async (
    profileId: string,
    extractedSubjects: ExtractedSubject[],
    assessments: Record<string, 'new' | 'some' | 'confident'>,
  ) => {
    const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4']
    const FAMILIARITY_MAP = {
      new: { confidence: 0, mastery: 0 },
      some: { confidence: 0.5, mastery: 0.2 },
      confident: { confidence: 0.8, mastery: 0.4 },
    }

    // Normalize weights to sum to 100
    const equalShare = 100 / extractedSubjects.length
    const effectiveWeights = extractedSubjects.map(s => s.weight > 0 ? s.weight : equalShare)
    const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0)
    const weightScale = 100 / totalWeight

    // Clear any existing blueprint-seeded subjects/topics/chapters
    await db.subtopics.where('examProfileId').equals(profileId).delete()
    await db.topics.where('examProfileId').equals(profileId).delete()
    await db.chapters.where('examProfileId').equals(profileId).delete()
    await db.subjects.where('examProfileId').equals(profileId).delete()

    const subjects: Subject[] = []
    const allChapters: import('../db/schema').Chapter[] = []
    const topics: Topic[] = []
    const subtopics: Subtopic[] = []
    const today = new Date().toISOString().slice(0, 10)

    for (let si = 0; si < extractedSubjects.length; si++) {
      const extracted = extractedSubjects[si]
      const subjectId = crypto.randomUUID()
      const normalizedWeight = Math.round(effectiveWeights[si] * weightScale)

      const subjectTopics: Topic[] = []

      // Use chapters if available, otherwise wrap flat topics in a default chapter
      const chapters = extracted.chapters && extracted.chapters.length > 0
        ? extracted.chapters
        : [{ name: 'General', topics: extracted.topics }]

      let topicCounter = 0
      for (let ci = 0; ci < chapters.length; ci++) {
        const chapter = chapters[ci]
        const chapterId = crypto.randomUUID()

        allChapters.push({
          id: chapterId,
          subjectId,
          examProfileId: profileId,
          name: chapter.name,
          order: ci,
        })

        for (let ti = 0; ti < chapter.topics.length; ti++) {
          const extractedTopic = chapter.topics[ti]
          const topicId = crypto.randomUUID()
          const key = `${si}-${topicCounter}`
          topicCounter++
          const level = assessments[key] ?? 'new'
          const { confidence, mastery } = FAMILIARITY_MAP[level]

          const topic: Topic = {
            id: topicId,
            subjectId,
            chapterId,
            examProfileId: profileId,
            name: extractedTopic.name,
            mastery,
            confidence,
            questionsAttempted: 0,
            questionsCorrect: 0,
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReviewDate: today,
          }
          topics.push(topic)
          subjectTopics.push(topic)

          for (const stName of extractedTopic.subtopics ?? []) {
            subtopics.push({
              id: crypto.randomUUID(),
              topicId,
              examProfileId: profileId,
              name: stName,
            })
          }
        }
      }

      // Subject mastery = average of its topic masteries
      const subjectMastery = subjectTopics.length > 0
        ? subjectTopics.reduce((sum, t) => sum + t.mastery, 0) / subjectTopics.length
        : 0

      subjects.push({
        id: subjectId,
        examProfileId: profileId,
        name: extracted.name,
        weight: normalizedWeight,
        mastery: subjectMastery,
        color: COLORS[si % COLORS.length],
        order: si,
      })
    }

    await db.subjects.bulkPut(subjects)
    await db.chapters.bulkPut(allChapters)
    await db.topics.bulkPut(topics)
    if (subtopics.length > 0) await db.subtopics.bulkPut(subtopics)
  }, [])

  const updateProfile = useCallback(async (
    profileId: string,
    updates: Partial<Pick<ExamProfile, 'name' | 'examDate' | 'weeklyTargetHours' | 'passingThreshold'>>
  ) => {
    await db.examProfiles.update(profileId, updates)
  }, [])

  const deleteProfile = useCallback(async (profileId: string) => {
    await db.transaction('rw', [
      db.examProfiles, db.subjects, db.topics, db.subtopics,
      db.studySessions, db.questionResults, db.documents, db.documentChunks,
      db.flashcardDecks, db.flashcards, db.assignments, db.conversations,
      db.chatMessages, db.dailyStudyLogs,
      db.tutorPreferences, db.sessionInsights, db.studyPlans, db.studyPlanDays,
      db.milestones, db.researchNotes, db.annotations, db.habitGoals, db.habitLogs,
      db.writingSessions, db.advisorMeetings,
      db.chapters, db.examSources, db.exercises, db.exerciseAttempts,
      db.conceptCards, db.conceptCardConnections,
    ], async () => {
      await db.subtopics.where('examProfileId').equals(profileId).delete()
      await db.topics.where('examProfileId').equals(profileId).delete()
      await db.subjects.where('examProfileId').equals(profileId).delete()
      await db.studySessions.where('examProfileId').equals(profileId).delete()
      await db.questionResults.where('examProfileId').equals(profileId).delete()
      await db.documentChunks.where('examProfileId').equals(profileId).delete()
      await db.documents.where('examProfileId').equals(profileId).delete()
      const decks = await db.flashcardDecks.where('examProfileId').equals(profileId).toArray()
      for (const deck of decks) {
        await db.flashcards.where('deckId').equals(deck.id).delete()
      }
      await db.flashcardDecks.where('examProfileId').equals(profileId).delete()
      await db.assignments.where('examProfileId').equals(profileId).delete()
      await db.dailyStudyLogs.where('examProfileId').equals(profileId).delete()
      await db.tutorPreferences.where('examProfileId').equals(profileId).delete()
      await db.sessionInsights.where('examProfileId').equals(profileId).delete()
      const plans = await db.studyPlans.where('examProfileId').equals(profileId).toArray()
      for (const plan of plans) {
        await db.studyPlanDays.where('planId').equals(plan.id).delete()
      }
      await db.studyPlans.where('examProfileId').equals(profileId).delete()
      // conversations & messages
      const convos = await db.conversations.where('examProfileId').equals(profileId).toArray()
      for (const c of convos) {
        await db.chatMessages.where('conversationId').equals(c.id).delete()
      }
      await db.conversations.where('examProfileId').equals(profileId).delete()
      // Research mode tables
      await db.milestones.where('examProfileId').equals(profileId).delete()
      await db.researchNotes.where('examProfileId').equals(profileId).delete()
      await db.annotations.where('examProfileId').equals(profileId).delete()
      const goals = await db.habitGoals.where('examProfileId').equals(profileId).toArray()
      for (const goal of goals) {
        await db.habitLogs.where('goalId').equals(goal.id).delete()
      }
      await db.habitGoals.where('examProfileId').equals(profileId).delete()
      await db.writingSessions.where('examProfileId').equals(profileId).delete()
      await db.advisorMeetings.where('examProfileId').equals(profileId).delete()
      // v16 tables
      await db.chapters.where('examProfileId').equals(profileId).delete()
      await db.exerciseAttempts.where('examProfileId').equals(profileId).delete()
      await db.exercises.where('examProfileId').equals(profileId).delete()
      await db.examSources.where('examProfileId').equals(profileId).delete()
      await db.conceptCardConnections.where('examProfileId').equals(profileId).delete()
      await db.conceptCards.where('examProfileId').equals(profileId).delete()
      await db.examProfiles.delete(profileId)
    })
  }, [])

  return {
    profiles,
    profilesLoaded,
    activeProfile,
    createProfile,
    seedTopicsForProfile,
    setActiveProfile,
    updateProfile,
    deleteProfile,
  }
}
