import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeNudge, type SessionResult } from '../queueNudges'

const t = (key: string, opts?: Record<string, unknown>) => {
  const parts = [key]
  if (opts) parts.push(JSON.stringify(opts))
  return parts.join(' ')
}

describe('computeNudge', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Always return > 0.4 so nudges aren't suppressed by randomness
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    randomSpy.mockRestore()
  })

  it('returns null 40% of the time', () => {
    randomSpy.mockReturnValue(0.3)
    const result = computeNudge({
      completedTopicName: 'Math', completedCount: 1, totalCount: 10,
      sessionResults: [], streak: 0,
    }, t)
    expect(result).toBeNull()
  })

  it('returns reinforcement when topic repeated >= 2 times', () => {
    const sessionResults: SessionResult[] = [
      { topicName: 'Math', type: 'practice', rating: 'good' },
      { topicName: 'Math', type: 'practice', rating: 'ok' },
    ]
    const result = computeNudge({
      completedTopicName: 'Math', completedCount: 3, totalCount: 10,
      sessionResults, streak: 0,
    }, t)
    expect(result?.type).toBe('reinforcement')
  })

  it('returns halfway progress nudge', () => {
    const result = computeNudge({
      completedTopicName: 'Physics', completedCount: 3, totalCount: 6,
      sessionResults: [{ topicName: 'Physics', type: 'quiz', rating: 'ok' }],
      streak: 0,
    }, t)
    expect(result?.type).toBe('progress')
  })

  it('returns encouragement for 3 good ratings in a row', () => {
    const sessionResults: SessionResult[] = [
      { topicName: 'A', type: 'q', rating: 'good' },
      { topicName: 'B', type: 'q', rating: 'good' },
      { topicName: 'C', type: 'q', rating: 'good' },
    ]
    const result = computeNudge({
      completedTopicName: 'C', completedCount: 4, totalCount: 10,
      sessionResults, streak: 0,
    }, t)
    expect(result?.type).toBe('encouragement')
  })

  it('returns streak nudge on first item with streak >= 7', () => {
    const result = computeNudge({
      completedTopicName: 'Math', completedCount: 1, totalCount: 10,
      sessionResults: [{ topicName: 'Math', type: 'q', rating: 'ok' }],
      streak: 10,
    }, t)
    expect(result?.type).toBe('encouragement')
    expect(result?.text).toContain('10')
  })

  it('returns almost done nudge', () => {
    const result = computeNudge({
      completedTopicName: 'Math', completedCount: 4, totalCount: 5,
      sessionResults: [{ topicName: 'Math', type: 'q', rating: 'ok' }],
      streak: 0,
    }, t)
    expect(result?.type).toBe('progress')
  })

  it('can return connection nudge', () => {
    // Set random to return 0.5 for null check, then 0.1 for connection check
    randomSpy.mockReturnValueOnce(0.5).mockReturnValueOnce(0.1)
    const sessionResults: SessionResult[] = [
      { topicName: 'Physics', type: 'q', rating: 'ok' },
      { topicName: 'Math', type: 'q', rating: 'ok' },
    ]
    const result = computeNudge({
      completedTopicName: 'Math', completedCount: 3, totalCount: 10,
      sessionResults, streak: 0,
    }, t)
    expect(result?.type).toBe('connection')
  })
})
