import { describe, it, expect } from 'vitest'
import { calculateSM2, getDueCards, createNewCard } from '../spacedRepetition'
import type { SM2Card } from '../spacedRepetition'

function makeCard(overrides: Partial<SM2Card> = {}): SM2Card {
  return {
    id: '1',
    front: 'Q',
    back: 'A',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date().toISOString().slice(0, 10),
    lastRating: 0,
    ...overrides,
  }
}

describe('calculateSM2', () => {
  it('resets repetitions and sets interval to 1 on fail (quality < 3)', () => {
    const card = makeCard({ repetitions: 5, interval: 30, easeFactor: 2.5 })
    const result = calculateSM2(1, card)
    expect(result.repetitions).toBe(0)
    expect(result.interval).toBe(1)
  })

  it('sets interval to 1 on first successful recall', () => {
    const card = makeCard({ repetitions: 0, interval: 0 })
    const result = calculateSM2(4, card)
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
  })

  it('sets interval to 6 on second successful recall', () => {
    const card = makeCard({ repetitions: 1, interval: 1 })
    const result = calculateSM2(4, card)
    expect(result.interval).toBe(6)
    expect(result.repetitions).toBe(2)
  })

  it('multiplies interval by easeFactor on subsequent recalls', () => {
    const card = makeCard({ repetitions: 2, interval: 6, easeFactor: 2.5 })
    const result = calculateSM2(4, card)
    expect(result.interval).toBe(15) // Math.round(6 * 2.5)
    expect(result.repetitions).toBe(3)
  })

  it('updates ease factor correctly', () => {
    const card = makeCard({ easeFactor: 2.5 })
    // quality 5: EF + (0.1 - (5-5)*(0.08+(5-5)*0.02)) = 2.5 + 0.1 = 2.6
    const result = calculateSM2(5, card)
    expect(result.easeFactor).toBeCloseTo(2.6, 1)
  })

  it('never lets ease factor drop below 1.3', () => {
    const card = makeCard({ easeFactor: 1.3 })
    const result = calculateSM2(0, card)
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3)
  })

  it('caps interval at 2 days in cram mode', () => {
    const card = makeCard({ repetitions: 2, interval: 6, easeFactor: 2.5 })
    const result = calculateSM2(5, card, true)
    expect(result.interval).toBeLessThanOrEqual(2)
  })

  it('clamps quality to 0-5 range', () => {
    const card = makeCard()
    const r1 = calculateSM2(-1, card)
    expect(r1.repetitions).toBe(0) // quality 0 = fail

    const r2 = calculateSM2(10, card)
    expect(r2.repetitions).toBe(1) // quality 5 = success
  })

  it('returns a valid future nextReviewDate', () => {
    const card = makeCard()
    const result = calculateSM2(4, card)
    const today = new Date().toISOString().slice(0, 10)
    expect(result.nextReviewDate >= today).toBe(true)
  })
})

describe('getDueCards', () => {
  it('returns only cards with nextReviewDate <= today', () => {
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

    const cards = [
      makeCard({ id: '1', nextReviewDate: yesterday }),
      makeCard({ id: '2', nextReviewDate: today }),
      makeCard({ id: '3', nextReviewDate: tomorrow }),
    ]

    const due = getDueCards(cards)
    expect(due.map(c => c.id)).toEqual(['1', '2'])
  })

  it('returns empty array for no due cards', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const cards = [makeCard({ nextReviewDate: tomorrow })]
    expect(getDueCards(cards)).toHaveLength(0)
  })
})

describe('createNewCard', () => {
  it('creates card with default SM-2 values', () => {
    const card = createNewCard('test-id', 'front', 'back')
    expect(card.id).toBe('test-id')
    expect(card.easeFactor).toBe(2.5)
    expect(card.interval).toBe(0)
    expect(card.repetitions).toBe(0)
    expect(card.lastRating).toBe(0)
  })
})
