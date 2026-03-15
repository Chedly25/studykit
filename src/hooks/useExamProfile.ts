import { useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ExamProfile, ExamType, Subject, Topic, Subtopic } from '../db/schema'
import { getExamBlueprint } from '../lib/examTopicMaps'

export function useExamProfile() {
  const { userId } = useAuth()
  const effectiveUserId = userId ?? 'local'

  const profiles = useLiveQuery(
    () => db.examProfiles.where('userId').equals(effectiveUserId).toArray(),
    [effectiveUserId]
  ) ?? []
  const activeProfile = useLiveQuery(
    () => db.examProfiles.where('userId').equals(effectiveUserId).toArray()
      .then(all => all.find(p => p.isActive)),
    [effectiveUserId]
  )

  const createProfile = useCallback(async (
    name: string,
    examType: ExamType,
    examDate: string,
    weeklyTargetHours: number
  ): Promise<string> => {
    const blueprint = getExamBlueprint(examType)
    const profileId = crypto.randomUUID()

    // Deactivate all existing profiles
    await db.examProfiles.toCollection().modify({ isActive: false })

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
    }
    await db.examProfiles.put(profile)

    // Seed subjects, topics, subtopics
    const subjects: Subject[] = []
    const topics: Topic[] = []
    const subtopics: Subtopic[] = []
    const today = new Date().toISOString().slice(0, 10)

    for (let si = 0; si < blueprint.subjects.length; si++) {
      const seedSubj = blueprint.subjects[si]
      const subjectId = crypto.randomUUID()

      subjects.push({
        id: subjectId,
        examProfileId: profileId,
        name: seedSubj.name,
        weight: seedSubj.weight,
        mastery: 0,
        color: seedSubj.color,
        order: si,
      })

      for (const seedTopic of seedSubj.topics) {
        const topicId = crypto.randomUUID()

        topics.push({
          id: topicId,
          subjectId,
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
    await db.topics.bulkPut(topics)
    await db.subtopics.bulkPut(subtopics)

    return profileId
  }, [effectiveUserId])

  const setActiveProfile = useCallback(async (profileId: string) => {
    await db.examProfiles.toCollection().modify({ isActive: false })
    await db.examProfiles.update(profileId, { isActive: true })
  }, [])

  const deleteProfile = useCallback(async (profileId: string) => {
    await db.transaction('rw', [
      db.examProfiles, db.subjects, db.topics, db.subtopics,
      db.studySessions, db.questionResults, db.documents, db.documentChunks,
      db.flashcardDecks, db.flashcards, db.assignments, db.conversations,
      db.chatMessages, db.dailyStudyLogs,
      db.tutorPreferences, db.sessionInsights, db.studyPlans, db.studyPlanDays,
    ], async () => {
      await db.subtopics.where('examProfileId').equals(profileId).delete()
      await db.topics.where('examProfileId').equals(profileId).delete()
      await db.subjects.where('examProfileId').equals(profileId).delete()
      await db.studySessions.where('examProfileId').equals(profileId).delete()
      await db.questionResults.where('examProfileId').equals(profileId).delete()
      await db.documentChunks.where('examProfileId').equals(profileId).delete()
      await db.documents.where('examProfileId').equals(profileId).delete()
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
      await db.examProfiles.delete(profileId)
    })
  }, [])

  return {
    profiles,
    activeProfile,
    createProfile,
    setActiveProfile,
    deleteProfile,
  }
}
