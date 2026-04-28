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

// ─── Misconception-driven interval modulation ────────────────────────────

/** Narrow shape consumed by the modulator — decoupled from the Misconception db type. */
export interface MisconceptionLite {
  /** 1 (mild) — 5 (severe). Defaults to 1 if missing. */
  severity?: number
  /** ISO timestamp of last occurrence. */
  lastSeenAt: string
  /** ISO timestamp; presence means the misconception is no longer active. */
  resolvedAt?: string
}

/** Days over which a misconception's freshness decays from 1.0 to 0.0. */
const FRESHNESS_DECAY_DAYS = 30
/** Maximum interval-shortening multiplier (0.5 = at most halve). */
const MAX_TIGHTENING = 0.5

/**
 * Tighten the SM-2 interval when the parent topic has fresh, unresolved
 * misconceptions. This is the moat over generic SRS: cards on conceptually-shaky
 * topics return faster, calibrated by misconception severity and recency.
 *
 *   freshness  = clamp(1 - daysSinceLastSeen / 30, 0, 1)
 *   weight     = max over unresolved misconceptions: freshness × (severity / 5)
 *   multiplier = 1 - 0.5 × weight                       // 1.0 → 0.5
 *   interval'  = max(1, round(interval × multiplier))
 *
 * Bypassed (returns base unchanged) when:
 *   - quality === 5 (perfect recall): full SM-2 reward
 *   - quality < 3 (failure): SM-2 already reset to interval=1
 *   - no unresolved + fresh misconceptions on the topic
 *
 * Pure function; safe to unit-test.
 */
export function modulateIntervalForMisconceptions(
  base: SM2Result,
  quality: number,
  misconceptions: readonly MisconceptionLite[],
  now: Date = new Date(),
): SM2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)))
  if (q === 5 || q < 3) return base
  if (misconceptions.length === 0) return base

  const nowMs = now.getTime()
  let weight = 0
  for (const m of misconceptions) {
    if (m.resolvedAt) continue
    const lastSeenMs = Date.parse(m.lastSeenAt)
    if (Number.isNaN(lastSeenMs)) continue
    const daysSinceLastSeen = Math.max(0, (nowMs - lastSeenMs) / (1000 * 60 * 60 * 24))
    const freshness = Math.max(0, 1 - daysSinceLastSeen / FRESHNESS_DECAY_DAYS)
    if (freshness === 0) continue
    const severityNorm = Math.max(1, Math.min(5, m.severity ?? 1)) / 5
    const w = freshness * severityNorm
    if (w > weight) weight = w
  }

  if (weight === 0) return base

  const multiplier = 1 - MAX_TIGHTENING * weight
  const newInterval = Math.max(1, Math.round(base.interval * multiplier))
  if (newInterval === base.interval) return base

  // Recompute nextReviewDate from `now` so we stay calendar-day-aligned.
  const next = new Date(now)
  next.setDate(next.getDate() + newInterval)
  const nextReviewDate = next.toISOString().slice(0, 10)

  return {
    easeFactor: base.easeFactor,
    interval: newInterval,
    repetitions: base.repetitions,
    nextReviewDate,
  }
}
