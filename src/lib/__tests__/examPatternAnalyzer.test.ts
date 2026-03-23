import { describe, it, expect, vi } from 'vitest'

// Mock db since it requires IndexedDB
vi.mock('../../db', () => ({
  db: {
    examSources: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 'es1', examProfileId: 'p1', documentId: 'd1', name: 'Exam 2023', year: 2023, institution: 'UNI', totalExercises: 5, parsedAt: '' },
            { id: 'es2', examProfileId: 'p1', documentId: 'd2', name: 'Exam 2024', year: 2024, institution: 'UNI', totalExercises: 4, parsedAt: '' },
          ]),
        }),
      }),
    },
    exercises: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([
              { id: 'e1', examSourceId: 'es1', examProfileId: 'p1', exerciseNumber: 1, text: '', difficulty: 3, topicIds: '["t1"]', status: 'not_attempted', attemptCount: 0, createdAt: '', easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewDate: '' },
              { id: 'e2', examSourceId: 'es1', examProfileId: 'p1', exerciseNumber: 2, text: '', difficulty: 4, topicIds: '["t1"]', status: 'not_attempted', attemptCount: 0, createdAt: '', easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewDate: '' },
              { id: 'e3', examSourceId: 'es2', examProfileId: 'p1', exerciseNumber: 1, text: '', difficulty: 3, topicIds: '["t1"]', status: 'not_attempted', attemptCount: 0, createdAt: '', easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewDate: '' },
              { id: 'e4', examSourceId: 'es2', examProfileId: 'p1', exerciseNumber: 2, text: '', difficulty: 2, topicIds: '["t2"]', status: 'not_attempted', attemptCount: 0, createdAt: '', easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewDate: '' },
            ]),
          }),
        }),
      }),
    },
    topics: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 't1', name: 'Algebra', subjectId: 's1', examProfileId: 'p1', mastery: 0.5, confidence: 0.5, questionsAttempted: 0, questionsCorrect: 0, easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewDate: '' },
            { id: 't2', name: 'Geometry', subjectId: 's1', examProfileId: 'p1', mastery: 0.3, confidence: 0.3, questionsAttempted: 0, questionsCorrect: 0, easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewDate: '' },
          ]),
        }),
      }),
    },
  },
}))

import { analyzeExamPatterns } from '../examPatternAnalyzer'

describe('analyzeExamPatterns', () => {
  it('computes frequency as fraction of exams a topic appears in', async () => {
    const result = await analyzeExamPatterns('p1')
    expect(result.totalExams).toBe(2)

    // t1 appears in both exams → frequency = 1.0
    const algebraPattern = result.patterns.find(p => p.topicName === 'Algebra')
    expect(algebraPattern).toBeDefined()
    expect(algebraPattern!.frequency).toBe(1.0)

    // t2 appears in 1 of 2 exams → frequency = 0.5
    const geoPattern = result.patterns.find(p => p.topicName === 'Geometry')
    expect(geoPattern).toBeDefined()
    expect(geoPattern!.frequency).toBe(0.5)
  })

  it('computes average difficulty', async () => {
    const result = await analyzeExamPatterns('p1')
    const algebraPattern = result.patterns.find(p => p.topicName === 'Algebra')
    // Difficulties: 3, 4, 3 → avg = 3.3
    expect(algebraPattern!.avgDifficulty).toBeCloseTo(3.3, 1)
  })

  it('generates predictions for high-frequency topics', async () => {
    const result = await analyzeExamPatterns('p1')
    // Algebra at 100% → should have prediction
    expect(result.predictions.some(p => p.includes('Algebra'))).toBe(true)
  })

  it('extracts exam years', async () => {
    const result = await analyzeExamPatterns('p1')
    expect(result.examYears).toEqual([2023, 2024])
  })

  it('sorts patterns by frequency descending', async () => {
    const result = await analyzeExamPatterns('p1')
    for (let i = 1; i < result.patterns.length; i++) {
      expect(result.patterns[i - 1].frequency).toBeGreaterThanOrEqual(result.patterns[i].frequency)
    }
  })
})
