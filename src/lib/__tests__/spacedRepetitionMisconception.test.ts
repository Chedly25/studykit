import { describe, it, expect } from 'vitest'
import {
  modulateIntervalForMisconceptions,
  type MisconceptionLite,
  type SM2Result,
} from '../spacedRepetition'

const FIXED_NOW = new Date('2026-04-28T12:00:00Z')

function daysAgo(n: number): string {
  return new Date(FIXED_NOW.getTime() - n * 86400000).toISOString()
}

function base(interval: number): SM2Result {
  // Make the embedded date deterministic for assertions.
  const next = new Date(FIXED_NOW)
  next.setDate(next.getDate() + interval)
  return {
    easeFactor: 2.5,
    interval,
    repetitions: 3,
    nextReviewDate: next.toISOString().slice(0, 10),
  }
}

describe('modulateIntervalForMisconceptions', () => {
  it('returns the base unchanged when there are no misconceptions', () => {
    const out = modulateIntervalForMisconceptions(base(10), 4, [], FIXED_NOW)
    expect(out).toEqual(base(10))
  })

  it('returns the base unchanged when quality === 5 (perfect recall)', () => {
    const m: MisconceptionLite = { severity: 5, lastSeenAt: daysAgo(0) }
    const out = modulateIntervalForMisconceptions(base(20), 5, [m], FIXED_NOW)
    expect(out).toEqual(base(20))
  })

  it('returns the base unchanged when quality < 3 (failure already resets)', () => {
    const m: MisconceptionLite = { severity: 5, lastSeenAt: daysAgo(0) }
    const out = modulateIntervalForMisconceptions(base(1), 1, [m], FIXED_NOW)
    expect(out).toEqual(base(1))
  })

  it('halves the interval at quality=3 with severity=5 lastSeen=today', () => {
    const m: MisconceptionLite = { severity: 5, lastSeenAt: daysAgo(0) }
    const out = modulateIntervalForMisconceptions(base(20), 3, [m], FIXED_NOW)
    // freshness=1, severity_norm=1, weight=1, multiplier=0.5 → 20 * 0.5 = 10
    expect(out.interval).toBe(10)
    expect(out.easeFactor).toBe(2.5) // unchanged
    expect(out.repetitions).toBe(3) // unchanged
  })

  it('moderately tightens at quality=4 with severity=3 lastSeen=15d ago', () => {
    const m: MisconceptionLite = { severity: 3, lastSeenAt: daysAgo(15) }
    const out = modulateIntervalForMisconceptions(base(20), 4, [m], FIXED_NOW)
    // freshness=0.5, severity_norm=0.6, weight=0.3, multiplier=0.85 → 20 * 0.85 = 17
    expect(out.interval).toBe(17)
  })

  it('returns the base unchanged once a misconception is older than 30 days', () => {
    const m: MisconceptionLite = { severity: 5, lastSeenAt: daysAgo(31) }
    const out = modulateIntervalForMisconceptions(base(20), 4, [m], FIXED_NOW)
    expect(out).toEqual(base(20))
  })

  it('ignores resolved misconceptions even when severe and fresh', () => {
    const m: MisconceptionLite = {
      severity: 5,
      lastSeenAt: daysAgo(0),
      resolvedAt: FIXED_NOW.toISOString(),
    }
    const out = modulateIntervalForMisconceptions(base(20), 3, [m], FIXED_NOW)
    expect(out).toEqual(base(20))
  })

  it('takes the MAX severity across multiple misconceptions, not the sum', () => {
    const ms: MisconceptionLite[] = [
      { severity: 1, lastSeenAt: daysAgo(0) },
      { severity: 5, lastSeenAt: daysAgo(0) },
      { severity: 2, lastSeenAt: daysAgo(0) },
    ]
    const out = modulateIntervalForMisconceptions(base(20), 3, ms, FIXED_NOW)
    expect(out.interval).toBe(10) // same as severity=5 alone
  })

  it('recomputes nextReviewDate when interval changes', () => {
    const m: MisconceptionLite = { severity: 5, lastSeenAt: daysAgo(0) }
    const out = modulateIntervalForMisconceptions(base(20), 3, [m], FIXED_NOW)
    const expected = new Date(FIXED_NOW)
    expected.setDate(expected.getDate() + 10)
    expect(out.nextReviewDate).toBe(expected.toISOString().slice(0, 10))
  })

  it('floors the interval at 1 day even at maximum tightening', () => {
    const m: MisconceptionLite = { severity: 5, lastSeenAt: daysAgo(0) }
    // base interval 1: 1 * 0.5 = 0.5 → rounded to 1, NOT 0
    const out = modulateIntervalForMisconceptions(base(1), 4, [m], FIXED_NOW)
    expect(out.interval).toBeGreaterThanOrEqual(1)
  })

  it('defaults severity to 1 when missing on the misconception', () => {
    const m: MisconceptionLite = { lastSeenAt: daysAgo(0) }
    const out = modulateIntervalForMisconceptions(base(20), 3, [m], FIXED_NOW)
    // weight = 1 * (1/5) = 0.2, multiplier = 0.9, 20 * 0.9 = 18
    expect(out.interval).toBe(18)
  })

  it('skips misconceptions with malformed lastSeenAt without throwing', () => {
    const ms: MisconceptionLite[] = [
      { severity: 5, lastSeenAt: 'not-a-date' },
      { severity: 4, lastSeenAt: daysAgo(0) },
    ]
    const out = modulateIntervalForMisconceptions(base(20), 3, ms, FIXED_NOW)
    // Only the well-formed one counts: weight = 1 * 0.8 = 0.8, multiplier = 0.6, 20 * 0.6 = 12
    expect(out.interval).toBe(12)
  })
})
