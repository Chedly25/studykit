/**
 * Centralized topic mastery computation and SRS advancement.
 * Activates the 4-factor computeTopicMastery formula and topic-level SM-2.
 */
import { db } from '../db'
import { computeTopicMastery, computeSubjectMastery } from './knowledgeGraph'
import { calculateSM2 } from './spacedRepetition'

/**
 * Recompute topic mastery using the full 4-factor formula:
 * flashcard retention (30%) + question accuracy (40%) + recency (15%) + confidence (15%).
 * Also recomputes the parent subject's mastery as the average of its topics.
 */
export async function recomputeTopicMastery(topicId: string): Promise<number> {
  const topic = await db.topics.get(topicId)
  if (!topic) return 0

  // Gather flashcards for this topic
  const flashcards = await db.flashcards
    .where('topicId')
    .equals(topicId)
    .toArray()

  // Gather question results for this topic
  const questionResults = await db.questionResults
    .where('topicId')
    .equals(topicId)
    .toArray()

  // Compute mastery using the full formula
  const mastery = computeTopicMastery({ topic, flashcards, questionResults })

  await db.topics.update(topicId, { mastery })

  // Recompute subject mastery as average of all subject topics
  const subjectTopics = await db.topics
    .where('subjectId')
    .equals(topic.subjectId)
    .toArray()
  // Use the freshly computed mastery for this topic
  const updatedTopics = subjectTopics.map(t =>
    t.id === topicId ? { ...t, mastery } : t
  )
  const subjectMastery = computeSubjectMastery(updatedTopics)
  await db.subjects.update(topic.subjectId, { mastery: subjectMastery })

  return mastery
}

/**
 * Advance topic-level SRS using SM-2 algorithm.
 * Updates easeFactor, interval, repetitions, and nextReviewDate on the topic.
 * This makes decayedMastery() work properly — intervals advance, stability increases.
 */
export async function advanceTopicSRS(topicId: string, quality: number): Promise<void> {
  const topic = await db.topics.get(topicId)
  if (!topic) return

  const result = calculateSM2(quality, {
    id: topic.id,
    front: '',
    back: '',
    easeFactor: topic.easeFactor,
    interval: topic.interval,
    repetitions: topic.repetitions,
    nextReviewDate: topic.nextReviewDate,
    lastRating: quality,
  })

  await db.topics.update(topicId, {
    easeFactor: result.easeFactor,
    interval: result.interval,
    repetitions: result.repetitions,
    nextReviewDate: result.nextReviewDate,
  })
}
