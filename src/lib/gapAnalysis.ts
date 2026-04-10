/**
 * Gap Analysis — compare the user's uploaded courses against the official
 * CPGE MP programme to find missing topics.
 *
 * Algorithm: for each topic in the programme, semantic search the user's
 * course documents. If no strong match is found, the topic is flagged as
 * missing.
 */
import { hybridSearch } from './hybridSearch'
import { SUBJECTS } from '../db/seed/cpgeMP'

export type GapStatus = 'covered' | 'weak' | 'missing'

export interface TopicGap {
  subjectName: string
  chapterName: string
  topicName: string
  status: GapStatus
  bestScore: number
}

export interface SubjectGap {
  subjectName: string
  weight: number
  topicsTotal: number
  topicsCovered: number
  topicsWeak: number
  topicsMissing: number
  coveragePercent: number
  chapters: Array<{
    chapterName: string
    topics: TopicGap[]
  }>
}

export interface GapAnalysisResult {
  subjects: SubjectGap[]
  overallCoveragePercent: number
  totalTopics: number
  coveredTopics: number
  missingTopics: number
  analyzedAt: string
}

const COVERED_THRESHOLD = 0.55
const WEAK_THRESHOLD = 0.35

/**
 * Compute gaps between user's uploaded courses and the CPGE MP programme.
 * Makes one hybrid search call per topic (~87 calls for full programme).
 */
export async function computeCourseGaps(
  examProfileId: string,
  authToken: string | undefined,
  onProgress?: (done: number, total: number) => void,
): Promise<GapAnalysisResult> {
  const totalTopics = SUBJECTS.reduce(
    (sum, s) => sum + s.chapters.reduce((cs, c) => cs + c.topics.length, 0),
    0,
  )

  const subjectGaps: SubjectGap[] = []
  let done = 0

  for (const subject of SUBJECTS) {
    const chapters: SubjectGap['chapters'] = []
    let covered = 0
    let weak = 0
    let missing = 0
    let topicsInSubject = 0

    for (const chapter of subject.chapters) {
      const chapterTopics: TopicGap[] = []

      for (const topicName of chapter.topics) {
        topicsInSubject++
        // Semantic search in the user's course docs for this topic
        const results = await hybridSearch(
          examProfileId,
          topicName,
          authToken,
          { topN: 3, rerank: false },
        ).catch(() => [])

        const bestScore = results.length > 0 ? results[0].score : 0
        let status: GapStatus
        if (bestScore >= COVERED_THRESHOLD) {
          status = 'covered'
          covered++
        } else if (bestScore >= WEAK_THRESHOLD) {
          status = 'weak'
          weak++
        } else {
          status = 'missing'
          missing++
        }

        chapterTopics.push({
          subjectName: subject.name,
          chapterName: chapter.name,
          topicName,
          status,
          bestScore,
        })

        done++
        onProgress?.(done, totalTopics)
      }

      chapters.push({ chapterName: chapter.name, topics: chapterTopics })
    }

    subjectGaps.push({
      subjectName: subject.name,
      weight: subject.weight,
      topicsTotal: topicsInSubject,
      topicsCovered: covered,
      topicsWeak: weak,
      topicsMissing: missing,
      coveragePercent: topicsInSubject > 0 ? Math.round((covered / topicsInSubject) * 100) : 0,
      chapters,
    })
  }

  const totalCovered = subjectGaps.reduce((s, sg) => s + sg.topicsCovered, 0)
  const totalMissing = subjectGaps.reduce((s, sg) => s + sg.topicsMissing, 0)

  return {
    subjects: subjectGaps,
    overallCoveragePercent: Math.round((totalCovered / totalTopics) * 100),
    totalTopics,
    coveredTopics: totalCovered,
    missingTopics: totalMissing,
    analyzedAt: new Date().toISOString(),
  }
}
