import { describe, it, expect } from 'vitest'
import { formatTime, formatTimeHMS } from '../timerUtils'

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0)).toBe('00:00')
  })

  it('formats seconds only', () => {
    expect(formatTime(45)).toBe('00:45')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(125)).toBe('02:05')
  })

  it('formats over an hour', () => {
    expect(formatTime(3912)).toBe('65:12')
  })

  it('handles negative values', () => {
    expect(formatTime(-5)).toBe('00:00')
  })

  it('handles fractional seconds', () => {
    expect(formatTime(60.7)).toBe('01:00')
  })
})

describe('formatTimeHMS', () => {
  it('formats seconds only', () => {
    expect(formatTimeHMS(30)).toBe('30s')
  })

  it('formats minutes and seconds', () => {
    expect(formatTimeHMS(330)).toBe('5m 30s')
  })

  it('formats hours, minutes, seconds', () => {
    expect(formatTimeHMS(3661)).toBe('1h 1m 1s')
  })

  it('includes 0m when hours present', () => {
    expect(formatTimeHMS(3605)).toBe('1h 0m 5s')
  })

  it('handles zero', () => {
    expect(formatTimeHMS(0)).toBe('0s')
  })
})
