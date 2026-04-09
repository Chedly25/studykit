import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getDaysLeft } from '../examDateUtils'
import type { ExamProfile } from '../../db/schema'

function makeProfile(overrides: Partial<ExamProfile> = {}): ExamProfile {
  return {
    id: 'p1', name: 'Test', type: 'university-course',
    examDate: '2024-02-01', createdAt: '2024-01-01',
    ...overrides,
  } as ExamProfile
}

describe('getDaysLeft', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns days until exam', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    expect(getDaysLeft(makeProfile({ examDate: '2024-01-11' }))).toBe(10)
  })

  it('returns 0 for past exam dates', () => {
    vi.setSystemTime(new Date('2024-03-01T00:00:00Z'))
    expect(getDaysLeft(makeProfile({ examDate: '2024-01-01' }))).toBe(0)
  })

  it('returns null when no exam date', () => {
    expect(getDaysLeft(makeProfile({ examDate: '' }))).toBeNull()
  })

  it('returns null for undefined exam date', () => {
    expect(getDaysLeft(makeProfile({ examDate: undefined } as any))).toBeNull()
  })
})
