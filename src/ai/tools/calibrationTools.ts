import { db } from '../../db'
import { getMiscalibratedTopicsFromRaw } from '../../lib/calibration'

export async function getCalibrationData(
  examProfileId: string,
  threshold = 0.2,
): Promise<string> {
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const subjects = await db.subjects.where('examProfileId').equals(examProfileId).toArray()

  const miscalibrated = getMiscalibratedTopicsFromRaw(topics, subjects, threshold)

  return JSON.stringify({
    totalTopicsAnalyzed: topics.filter(t => t.questionsAttempted >= 3).length,
    miscalibratedCount: miscalibrated.length,
    overconfident: miscalibrated.filter(d => d.isOverconfident).map(d => ({
      topic: d.topicName,
      subject: d.subjectName,
      confidence: Math.round(d.confidence * 100),
      mastery: Math.round(d.mastery * 100),
      gap: Math.round(d.gap * 100),
    })),
    underconfident: miscalibrated.filter(d => d.isUnderconfident).map(d => ({
      topic: d.topicName,
      subject: d.subjectName,
      confidence: Math.round(d.confidence * 100),
      mastery: Math.round(d.mastery * 100),
      gap: Math.round(d.gap * 100),
    })),
  }, null, 2)
}
