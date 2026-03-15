import type { Topic, Subject } from '../db/schema'

export interface CalibrationData {
  topicName: string
  subjectName: string
  confidence: number
  mastery: number
  gap: number
  isOverconfident: boolean
  isUnderconfident: boolean
}

export function computeCalibrationData(topics: Topic[], subjects: Subject[]): CalibrationData[] {
  const subjectMap = new Map(subjects.map(s => [s.id, s.name]))

  return topics
    .filter(t => t.questionsAttempted >= 1)
    .map(t => {
      const gap = t.confidence - t.mastery
      return {
        topicName: t.name,
        subjectName: subjectMap.get(t.subjectId) ?? 'Unknown',
        confidence: t.confidence,
        mastery: t.mastery,
        gap,
        isOverconfident: gap > 0.2,
        isUnderconfident: gap < -0.2,
      }
    })
}

export function getMiscalibratedTopics(
  topics: Topic[],
  subjects: Subject[],
  threshold = 0.2,
): CalibrationData[] {
  const qualified = topics.filter(t => t.questionsAttempted >= 3)
  return computeCalibrationData(qualified, subjects)
    .filter(d => Math.abs(d.gap) > threshold)
}

// Fix: questionsAttempted isn't on CalibrationData, filter before mapping
export function getMiscalibratedTopicsFromRaw(
  topics: Topic[],
  subjects: Subject[],
  threshold = 0.2,
): CalibrationData[] {
  const subjectMap = new Map(subjects.map(s => [s.id, s.name]))

  return topics
    .filter(t => t.questionsAttempted >= 3)
    .map(t => {
      const gap = t.confidence - t.mastery
      return {
        topicName: t.name,
        subjectName: subjectMap.get(t.subjectId) ?? 'Unknown',
        confidence: t.confidence,
        mastery: t.mastery,
        gap,
        isOverconfident: gap > threshold,
        isUnderconfident: gap < -threshold,
      }
    })
    .filter(d => Math.abs(d.gap) > threshold)
}
