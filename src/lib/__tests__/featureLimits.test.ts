import { describe, it, expect } from 'vitest'
import { FREE_MONTHLY_EXAM_LIMIT, FREE_PROCESSING_LIMIT } from '../featureLimits'

describe('featureLimits', () => {
  it('FREE_MONTHLY_EXAM_LIMIT equals 2', () => {
    expect(FREE_MONTHLY_EXAM_LIMIT).toBe(2)
  })

  it('FREE_PROCESSING_LIMIT equals 3', () => {
    expect(FREE_PROCESSING_LIMIT).toBe(3)
  })

  it('both limits are positive numbers', () => {
    expect(FREE_MONTHLY_EXAM_LIMIT).toBeGreaterThan(0)
    expect(FREE_PROCESSING_LIMIT).toBeGreaterThan(0)
  })

  it('both limits are integers', () => {
    expect(Number.isInteger(FREE_MONTHLY_EXAM_LIMIT)).toBe(true)
    expect(Number.isInteger(FREE_PROCESSING_LIMIT)).toBe(true)
  })
})
