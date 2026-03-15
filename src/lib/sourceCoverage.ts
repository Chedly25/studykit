import { db } from '../db'
import type { DocumentChunk } from '../db/schema'

export interface SubjectCoverage {
  subjectName: string
  totalTopics: number
  coveredTopics: number
  coveragePercent: number
}

export interface CoverageSummary {
  totalTopics: number
  coveredTopics: number
  coveragePercent: number
  subjectBreakdown: SubjectCoverage[]
  uncoveredHighPriority: { topicName: string; subjectName: string; mastery: number }[]
}

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 2)
  )
}

function hasKeywordOverlap(topicName: string, chunk: DocumentChunk): boolean {
  const topicTokens = tokenize(topicName)
  const chunkKeywords = new Set(chunk.keywords.split(',').filter(Boolean))

  let matches = 0
  for (const token of topicTokens) {
    if (chunkKeywords.has(token)) matches++
  }
  // Require at least 1 matching keyword, or > 30% overlap for short topic names
  const threshold = topicTokens.size <= 3 ? 1 : Math.ceil(topicTokens.size * 0.3)
  return matches >= threshold
}

export async function computeSourceCoverage(examProfileId: string): Promise<CoverageSummary> {
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const subjects = await db.subjects.where('examProfileId').equals(examProfileId).toArray()
  const chunks = await db.documentChunks.where('examProfileId').equals(examProfileId).toArray()

  const subjectMap = new Map(subjects.map(s => [s.id, s]))
  const coveredTopicIds = new Set<string>()

  for (const topic of topics) {
    // Check if any chunk has explicit topicId match
    const hasExplicit = chunks.some(c => c.topicId === topic.id)
    if (hasExplicit) {
      coveredTopicIds.add(topic.id)
      continue
    }
    // Check keyword overlap
    const hasOverlap = chunks.some(c => hasKeywordOverlap(topic.name, c))
    if (hasOverlap) {
      coveredTopicIds.add(topic.id)
    }
  }

  // Subject breakdown
  const subjectBreakdown: SubjectCoverage[] = []
  for (const subject of subjects) {
    const subjectTopics = topics.filter(t => t.subjectId === subject.id)
    const covered = subjectTopics.filter(t => coveredTopicIds.has(t.id)).length
    subjectBreakdown.push({
      subjectName: subject.name,
      totalTopics: subjectTopics.length,
      coveredTopics: covered,
      coveragePercent: subjectTopics.length > 0 ? Math.round((covered / subjectTopics.length) * 100) : 0,
    })
  }

  // Uncovered high-priority: topics with low mastery and no coverage
  const uncoveredHighPriority = topics
    .filter(t => !coveredTopicIds.has(t.id) && t.mastery < 0.5)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 5)
    .map(t => ({
      topicName: t.name,
      subjectName: subjectMap.get(t.subjectId)?.name ?? 'Unknown',
      mastery: Math.round(t.mastery * 100),
    }))

  return {
    totalTopics: topics.length,
    coveredTopics: coveredTopicIds.size,
    coveragePercent: topics.length > 0 ? Math.round((coveredTopicIds.size / topics.length) * 100) : 0,
    subjectBreakdown,
    uncoveredHighPriority,
  }
}
