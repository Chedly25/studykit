import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isCramModeActive, cramCapInterval } from '../cramModeEngine'

describe('isCramModeActive', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns true when exam is within 7 days', () => {
    vi.setSystemTime(new Date('2024-01-01'))
    expect(isCramModeActive('2024-01-05')).toBe(true)
  })

  it('returns false when exam is more than 7 days away', () => {
    vi.setSystemTime(new Date('2024-01-01'))
    expect(isCramModeActive('2024-01-20')).toBe(false)
  })

  it('returns false when exam date is in the past', () => {
    vi.setSystemTime(new Date('2024-01-10'))
    expect(isCramModeActive('2024-01-05')).toBe(false)
  })

  it('returns true on manual override regardless of date', () => {
    vi.setSystemTime(new Date('2024-01-01'))
    expect(isCramModeActive('2024-06-01', true)).toBe(true)
  })

  it('returns false when exam date is empty', () => {
    expect(isCramModeActive('')).toBe(false)
  })

  it('returns true exactly on day 7', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    expect(isCramModeActive('2024-01-08')).toBe(true)
  })
})

describe('cramCapInterval', () => {
  it('caps intervals above 2 to 2', () => {
    expect(cramCapInterval(10)).toBe(2)
    expect(cramCapInterval(5)).toBe(2)
  })

  it('leaves intervals at or below 2 unchanged', () => {
    expect(cramCapInterval(2)).toBe(2)
    expect(cramCapInterval(1)).toBe(1)
    expect(cramCapInterval(0.5)).toBe(0.5)
  })
})
