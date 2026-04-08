import { describe, it, expect } from 'vitest'
import {
  computeWeeklyHoursChart,
  computeMasteryTrend,
  computeSessionDistribution,
  computeSubjectBalance,
  computeScoreTrend,
  computeMasteryHistory,
  predictTrajectory,
} from '../analyticsEngine'
import type { DailyStudyLog, QuestionResult, StudySession, MasterySnapshot } from '../../db/schema'
import type { MasteryHistoryPoint } from '../analyticsEngine'

// ─── Factory Helpers ────────────────────────────────────────────

function makeLog(overrides: Partial<DailyStudyLog> = {}): DailyStudyLog {
  return {
    id: 'log-1',
    examProfileId: 'ep-1',
    date: '2026-04-07',
    totalSeconds: 3600,
    subjectBreakdown: [{ subjectId: 'sub-1', seconds: 3600 }],
    questionsAnswered: 10,
    questionsCorrect: 8,
    ...overrides,
  }
}

function makeQuestionResult(overrides: Partial<QuestionResult> = {}): QuestionResult {
  return {
    id: 'qr-1',
    examProfileId: 'ep-1',
    topicId: 'topic-1',
    question: 'What is 2+2?',
    userAnswer: '4',
    correctAnswer: '4',
    isCorrect: true,
    difficulty: 3,
    confidence: 0.8,
    format: 'short-answer',
    explanation: 'Basic arithmetic',
    timestamp: '2026-04-07T10:00:00.000Z',
    ...overrides,
  }
}

function makeSession(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: 'sess-1',
    examProfileId: 'ep-1',
    startTime: '2026-04-07T08:00:00.000Z',
    endTime: '2026-04-07T09:00:00.000Z',
    durationSeconds: 3600,
    type: 'pomodoro',
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<MasterySnapshot> = {}): MasterySnapshot {
  return {
    id: 'snap-1',
    topicId: 'topic-1',
    examProfileId: 'ep-1',
    date: '2026-04-07',
    mastery: 0.5,
    ...overrides,
  }
}

function makeSubject(overrides: Partial<{ id: string; name: string; weight: number; mastery: number; color: string }> = {}) {
  return {
    id: 'sub-1',
    name: 'Math',
    weight: 50,
    mastery: 0.7,
    color: '#ff0000',
    ...overrides,
  }
}

/** Returns an ISO date string for today offset by `daysDelta` days (negative = past). */
function dateOffset(daysDelta: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysDelta)
  return d.toISOString().slice(0, 10)
}

/** Returns a full ISO timestamp for today offset by `daysDelta` days. */
function timestampOffset(daysDelta: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysDelta)
  return d.toISOString()
}

// ─── computeWeeklyHoursChart ────────────────────────────────────

describe('computeWeeklyHoursChart', () => {
  it('returns empty-valued entries for each day when logs are empty', () => {
    const result = computeWeeklyHoursChart([], 7)
    expect(result).toHaveLength(7)
    for (const entry of result) {
      expect(entry.hours).toBe(0)
      expect(entry.subjectBreakdown).toEqual({})
    }
  })

  it('fills in hours and subject breakdown for matching log dates', () => {
    const today = dateOffset(0)
    const log = makeLog({ date: today, totalSeconds: 7200, subjectBreakdown: [{ subjectId: 'sub-1', seconds: 3600 }, { subjectId: 'sub-2', seconds: 3600 }] })
    const result = computeWeeklyHoursChart([log], 7)

    const todayEntry = result.find(e => e.date === today)!
    expect(todayEntry.hours).toBe(2)
    expect(todayEntry.subjectBreakdown['sub-1']).toBe(1)
    expect(todayEntry.subjectBreakdown['sub-2']).toBe(1)
  })

  it('returns exactly `days` entries in chronological order', () => {
    const result = computeWeeklyHoursChart([], 3)
    expect(result).toHaveLength(3)
    expect(result[0].date).toBe(dateOffset(-2))
    expect(result[1].date).toBe(dateOffset(-1))
    expect(result[2].date).toBe(dateOffset(0))
  })

  it('ignores logs outside the date window', () => {
    const oldLog = makeLog({ date: dateOffset(-10) })
    const result = computeWeeklyHoursChart([oldLog], 7)
    for (const entry of result) {
      expect(entry.hours).toBe(0)
    }
  })

  it('handles a single day window', () => {
    const today = dateOffset(0)
    const log = makeLog({ date: today, totalSeconds: 1800 })
    const result = computeWeeklyHoursChart([log], 1)
    expect(result).toHaveLength(1)
    expect(result[0].hours).toBe(0.5)
  })
})

// ─── computeMasteryTrend ────────────────────────────────────────

describe('computeMasteryTrend', () => {
  it('returns empty array when no question results are provided', () => {
    expect(computeMasteryTrend([], 'topic-1')).toEqual([])
  })

  it('returns empty array when no results match the topicId', () => {
    const qr = makeQuestionResult({ topicId: 'other-topic', timestamp: timestampOffset(-1) })
    expect(computeMasteryTrend([qr], 'topic-1')).toEqual([])
  })

  it('returns empty array when all results are outside the date window', () => {
    const qr = makeQuestionResult({ timestamp: timestampOffset(-60) })
    expect(computeMasteryTrend([qr], 'topic-1', 30)).toEqual([])
  })

  it('computes running accuracy for matching results', () => {
    const results = [
      makeQuestionResult({ id: 'q1', isCorrect: true, timestamp: timestampOffset(-2) }),
      makeQuestionResult({ id: 'q2', isCorrect: false, timestamp: timestampOffset(-1) }),
      makeQuestionResult({ id: 'q3', isCorrect: true, timestamp: timestampOffset(0) }),
    ]
    const trend = computeMasteryTrend(results, 'topic-1', 30)
    expect(trend).toHaveLength(3)
    expect(trend[0].mastery).toBe(1)       // 1/1
    expect(trend[1].mastery).toBe(0.5)     // 1/2
    expect(trend[2].mastery).toBeCloseTo(2 / 3) // 2/3
  })

  it('sorts results by timestamp', () => {
    const results = [
      makeQuestionResult({ id: 'q1', timestamp: timestampOffset(-1) }),
      makeQuestionResult({ id: 'q2', timestamp: timestampOffset(-3) }),
    ]
    const trend = computeMasteryTrend(results, 'topic-1', 30)
    expect(trend[0].date).toBe(dateOffset(-3))
    expect(trend[1].date).toBe(dateOffset(-1))
  })
})

// ─── computeSessionDistribution ─────────────────────────────────

describe('computeSessionDistribution', () => {
  it('returns empty array for no sessions', () => {
    expect(computeSessionDistribution([])).toEqual([])
  })

  it('groups sessions by type and sums duration', () => {
    const sessions = [
      makeSession({ id: 's1', type: 'pomodoro', durationSeconds: 1500 }),
      makeSession({ id: 's2', type: 'pomodoro', durationSeconds: 1500 }),
      makeSession({ id: 's3', type: 'free', durationSeconds: 3600 }),
    ]
    const dist = computeSessionDistribution(sessions)
    const pomodoro = dist.find(d => d.type === 'pomodoro')!
    const free = dist.find(d => d.type === 'free')!

    expect(pomodoro.count).toBe(2)
    expect(pomodoro.totalMinutes).toBe(50) // 3000s = 50m
    expect(free.count).toBe(1)
    expect(free.totalMinutes).toBe(60)
  })

  it('handles a single session', () => {
    const dist = computeSessionDistribution([makeSession({ durationSeconds: 90 })])
    expect(dist).toHaveLength(1)
    expect(dist[0].count).toBe(1)
    expect(dist[0].totalMinutes).toBe(2) // Math.round(90/60) = 2
  })

  it('rounds totalMinutes correctly', () => {
    const sessions = [makeSession({ durationSeconds: 29 })] // 29/60 = 0.483 -> rounds to 0
    const dist = computeSessionDistribution(sessions)
    expect(dist[0].totalMinutes).toBe(0)
  })
})

// ─── computeSubjectBalance ──────────────────────────────────────

describe('computeSubjectBalance', () => {
  it('returns 0 actual for all subjects when totalTime is 0', () => {
    const subjects = [makeSubject(), makeSubject({ id: 'sub-2', name: 'Science', weight: 50 })]
    const logs = [makeLog({ totalSeconds: 0, subjectBreakdown: [] })]
    const result = computeSubjectBalance(subjects, logs)
    expect(result).toHaveLength(2)
    for (const s of result) {
      expect(s.actual).toBe(0)
    }
  })

  it('returns 0 actual for all subjects when logs array is empty', () => {
    const subjects = [makeSubject()]
    const result = computeSubjectBalance(subjects, [])
    expect(result).toHaveLength(1)
    expect(result[0].actual).toBe(0)
  })

  it('computes correct proportions with study time', () => {
    const subjects = [
      makeSubject({ id: 'sub-1', name: 'Math', weight: 60 }),
      makeSubject({ id: 'sub-2', name: 'Science', weight: 40 }),
    ]
    const logs = [
      makeLog({
        totalSeconds: 100,
        subjectBreakdown: [
          { subjectId: 'sub-1', seconds: 75 },
          { subjectId: 'sub-2', seconds: 25 },
        ],
      }),
    ]
    const result = computeSubjectBalance(subjects, logs)
    const math = result.find(r => r.name === 'Math')!
    const science = result.find(r => r.name === 'Science')!

    expect(math.actual).toBe(75)    // (75/100)*100
    expect(science.actual).toBe(25) // (25/100)*100
    expect(math.weight).toBe(60)
    expect(science.weight).toBe(40)
  })

  it('returns 0 actual for subjects with no logged time', () => {
    const subjects = [
      makeSubject({ id: 'sub-1' }),
      makeSubject({ id: 'sub-2', name: 'Science' }),
    ]
    const logs = [
      makeLog({
        totalSeconds: 100,
        subjectBreakdown: [{ subjectId: 'sub-1', seconds: 100 }],
      }),
    ]
    const result = computeSubjectBalance(subjects, logs)
    const science = result.find(r => r.name === 'Science')!
    expect(science.actual).toBe(0)
  })

  it('preserves mastery and color from input subjects', () => {
    const subjects = [makeSubject({ mastery: 0.85, color: '#00ff00' })]
    const result = computeSubjectBalance(subjects, [])
    expect(result[0].mastery).toBe(0.85)
    expect(result[0].color).toBe('#00ff00')
  })
})

// ─── computeScoreTrend ──────────────────────────────────────────

describe('computeScoreTrend', () => {
  it('returns empty array when no results are provided', () => {
    expect(computeScoreTrend([])).toEqual([])
  })

  it('returns empty array when results are fewer than window size', () => {
    const results = Array.from({ length: 5 }, (_, i) =>
      makeQuestionResult({ id: `q${i}`, timestamp: timestampOffset(-i) })
    )
    expect(computeScoreTrend(results, 10)).toEqual([])
  })

  it('produces first point at index windowSize-1', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeQuestionResult({ id: `q${i}`, isCorrect: true, timestamp: timestampOffset(-10 + i) })
    )
    const trend = computeScoreTrend(results, 10)
    expect(trend).toHaveLength(1)
    expect(trend[0].index).toBe(9)
    expect(trend[0].score).toBe(100)
  })

  it('computes sliding window accuracy correctly', () => {
    // 5 correct then 5 incorrect, window of 5
    const results = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeQuestionResult({ id: `c${i}`, isCorrect: true, timestamp: timestampOffset(-9 + i) })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeQuestionResult({ id: `w${i}`, isCorrect: false, timestamp: timestampOffset(-4 + i) })
      ),
    ]
    const trend = computeScoreTrend(results, 5)
    // Points at indices 4..9
    expect(trend).toHaveLength(6)
    expect(trend[0].score).toBe(100) // all 5 correct
    expect(trend[5].score).toBe(0)   // all 5 incorrect
  })

  it('handles window size of 1', () => {
    const results = [
      makeQuestionResult({ id: 'q1', isCorrect: true, timestamp: timestampOffset(-1) }),
      makeQuestionResult({ id: 'q2', isCorrect: false, timestamp: timestampOffset(0) }),
    ]
    const trend = computeScoreTrend(results, 1)
    expect(trend).toHaveLength(2)
    expect(trend[0].score).toBe(100)
    expect(trend[1].score).toBe(0)
  })
})

// ─── computeMasteryHistory ──────────────────────────────────────

describe('computeMasteryHistory', () => {
  it('returns empty array when snapshots are empty', () => {
    expect(computeMasteryHistory([], 'topic-1', 30)).toEqual([])
  })

  it('filters by topicId', () => {
    const snaps = [
      makeSnapshot({ topicId: 'topic-1', date: dateOffset(-1) }),
      makeSnapshot({ id: 'snap-2', topicId: 'topic-2', date: dateOffset(-1) }),
    ]
    const result = computeMasteryHistory(snaps, 'topic-1', 30)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe(dateOffset(-1))
  })

  it('filters by date cutoff', () => {
    const snaps = [
      makeSnapshot({ date: dateOffset(-5), mastery: 0.3 }),
      makeSnapshot({ id: 'snap-2', date: dateOffset(-60), mastery: 0.1 }),
    ]
    const result = computeMasteryHistory(snaps, 'topic-1', 30)
    expect(result).toHaveLength(1)
    expect(result[0].mastery).toBe(0.3)
  })

  it('sorts results chronologically', () => {
    const snaps = [
      makeSnapshot({ id: 'snap-a', date: dateOffset(-1), mastery: 0.8 }),
      makeSnapshot({ id: 'snap-b', date: dateOffset(-3), mastery: 0.5 }),
      makeSnapshot({ id: 'snap-c', date: dateOffset(-2), mastery: 0.6 }),
    ]
    const result = computeMasteryHistory(snaps, 'topic-1', 30)
    expect(result).toHaveLength(3)
    expect(result[0].mastery).toBe(0.5)
    expect(result[1].mastery).toBe(0.6)
    expect(result[2].mastery).toBe(0.8)
  })
})

// ─── predictTrajectory ──────────────────────────────────────────

describe('predictTrajectory', () => {
  it('returns null when fewer than 3 points', () => {
    expect(predictTrajectory([])).toBeNull()
    expect(predictTrajectory([{ date: '2026-04-01', mastery: 0.5 }])).toBeNull()
    expect(predictTrajectory([
      { date: '2026-04-01', mastery: 0.3 },
      { date: '2026-04-02', mastery: 0.4 },
    ])).toBeNull()
  })

  it('returns a valid targetDate for positive slope', () => {
    // Linearly increasing mastery: 0.1, 0.2, 0.3, ..., 0.5 over 5 days
    const history: MasteryHistoryPoint[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-04-0${i + 1}`,
      mastery: 0.1 * (i + 1),
    }))
    const result = predictTrajectory(history)
    expect(result).not.toBeNull()
    expect(result!.currentSlope).toBeGreaterThan(0)
    expect(result!.targetDate).not.toBe('')
    // Target date should be in the future relative to the last data point
    expect(result!.targetDate > '2026-04-05').toBe(true)
  })

  it('returns empty targetDate for negative slope', () => {
    const history: MasteryHistoryPoint[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-04-0${i + 1}`,
      mastery: 0.8 - 0.1 * i, // 0.8, 0.7, 0.6, 0.5, 0.4
    }))
    const result = predictTrajectory(history)
    expect(result).not.toBeNull()
    expect(result!.currentSlope).toBeLessThan(0)
    expect(result!.targetDate).toBe('')
  })

  it('returns empty targetDate for flat line (zero slope)', () => {
    const history: MasteryHistoryPoint[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-04-0${i + 1}`,
      mastery: 0.5,
    }))
    const result = predictTrajectory(history)
    expect(result).not.toBeNull()
    expect(result!.targetDate).toBe('')
  })

  it('uses only the last 14 points', () => {
    // 20 points total: first 6 are declining, last 14 are rising
    const history: MasteryHistoryPoint[] = [
      ...Array.from({ length: 6 }, (_, i) => ({
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        mastery: 0.8 - 0.1 * i,
      })),
      ...Array.from({ length: 14 }, (_, i) => ({
        date: `2026-03-${String(i + 10).padStart(2, '0')}`,
        mastery: 0.1 + 0.05 * i,
      })),
    ]
    const result = predictTrajectory(history)
    expect(result).not.toBeNull()
    // The slope should reflect the last 14 points (rising), not the first 6
    expect(result!.currentSlope).toBeGreaterThan(0)
  })

  it('returns null when all points share the same date (degenerate denominator)', () => {
    // All same date => all x values are 0 => denominator is 0
    const history: MasteryHistoryPoint[] = Array.from({ length: 5 }, (_, i) => ({
      date: '2026-04-01',
      mastery: 0.1 * (i + 1),
    }))
    const result = predictTrajectory(history)
    expect(result).toBeNull()
  })

  it('returns empty targetDate when slope is tiny and daysToFull overflows', () => {
    // Very slight slope with mastery near 0 -> daysToFull > 3650
    const history: MasteryHistoryPoint[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-04-0${i + 1}`,
      mastery: 0.001 + 0.0001 * i,
    }))
    const result = predictTrajectory(history)
    expect(result).not.toBeNull()
    expect(result!.currentSlope).toBeGreaterThan(0)
    expect(result!.targetDate).toBe('')
  })

  it('handles exactly 3 points', () => {
    const history: MasteryHistoryPoint[] = [
      { date: '2026-04-01', mastery: 0.2 },
      { date: '2026-04-02', mastery: 0.4 },
      { date: '2026-04-03', mastery: 0.6 },
    ]
    const result = predictTrajectory(history)
    expect(result).not.toBeNull()
    expect(result!.currentSlope).toBeGreaterThan(0)
    expect(result!.targetDate).not.toBe('')
  })
})
