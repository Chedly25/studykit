export interface SM2Card {
  id: string
  front: string
  back: string
  easeFactor: number
  interval: number // days
  repetitions: number
  nextReviewDate: string // ISO date string (YYYY-MM-DD)
  lastRating: number
}

export interface SM2Result {
  easeFactor: number
  interval: number
  repetitions: number
  nextReviewDate: string
}

/**
 * SM-2 algorithm implementation.
 * Quality ratings: 0 = complete blackout, 1 = wrong but remembered after seeing,
 * 2 = wrong but easy to recall, 3 = correct with difficulty, 4 = correct, 5 = perfect
 */
export function calculateSM2(quality: number, card: SM2Card, cramMode?: boolean): SM2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)))

  let { easeFactor, interval, repetitions } = card

  if (q < 3) {
    // Failed recall — reset
    repetitions = 0
    interval = 1
  } else {
    // Successful recall
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions += 1
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (easeFactor < 1.3) easeFactor = 1.3

  // Cram mode: cap interval at 2 days
  if (cramMode) {
    interval = Math.min(interval, 2)
  }

  // Calculate next review date
  const now = new Date()
  now.setDate(now.getDate() + interval)
  const nextReviewDate = now.toISOString().slice(0, 10)

  return { easeFactor, interval, repetitions, nextReviewDate }
}

/** Get cards that are due for review (nextReviewDate <= today) */
export function getDueCards(cards: SM2Card[]): SM2Card[] {
  const today = new Date().toISOString().slice(0, 10)
  return cards.filter(card => card.nextReviewDate <= today)
}

/** Create a new card with default SM-2 values */
export function createNewCard(id: string, front: string, back: string): SM2Card {
  return {
    id,
    front,
    back,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date().toISOString().slice(0, 10),
    lastRating: 0,
  }
}
