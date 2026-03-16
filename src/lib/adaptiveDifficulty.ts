/**
 * Adaptive difficulty selection for practice exams.
 * Selects next question based on performance streaks.
 */
import type { GeneratedQuestion } from '../db/schema'

export interface AdaptiveState {
  correctStreak: number
  incorrectStreak: number
  targetDifficulty: number
  answeredIndices: Set<number>
}

export function createAdaptiveState(): AdaptiveState {
  return {
    correctStreak: 0,
    incorrectStreak: 0,
    targetDifficulty: 3,
    answeredIndices: new Set(),
  }
}

/**
 * Update adaptive state after answering a question.
 */
export function updateAdaptiveState(
  state: AdaptiveState,
  isCorrect: boolean,
  questionIndex: number,
): AdaptiveState {
  const next = { ...state, answeredIndices: new Set(state.answeredIndices) }
  next.answeredIndices.add(questionIndex)

  if (isCorrect) {
    next.correctStreak = state.correctStreak + 1
    next.incorrectStreak = 0
    // 3+ correct in a row → increase difficulty
    if (next.correctStreak >= 3) {
      next.targetDifficulty = Math.min(5, state.targetDifficulty + 1)
      next.correctStreak = 0
    }
  } else {
    next.incorrectStreak = state.incorrectStreak + 1
    next.correctStreak = 0
    // 2+ wrong in a row → decrease difficulty
    if (next.incorrectStreak >= 2) {
      next.targetDifficulty = Math.max(1, state.targetDifficulty - 1)
      next.incorrectStreak = 0
    }
  }

  return next
}

/**
 * Pick the next unanswered question closest to target difficulty.
 * Returns -1 if all questions are answered (caller should handle completion).
 */
export function getNextQuestionIndex(
  questions: GeneratedQuestion[],
  state: AdaptiveState,
  currentIndex: number,
): number {
  const unanswered = questions
    .map((q, i) => ({ index: i, difficulty: q.difficulty }))
    .filter(q => !state.answeredIndices.has(q.index) && q.index !== currentIndex)

  if (unanswered.length === 0) {
    // Check if current question is also answered
    if (state.answeredIndices.has(currentIndex)) {
      return -1 // All questions answered
    }
    // Only current question left — stay on it
    return currentIndex
  }

  // Sort by distance from target difficulty, then by index for stability
  unanswered.sort((a, b) => {
    const distA = Math.abs(a.difficulty - state.targetDifficulty)
    const distB = Math.abs(b.difficulty - state.targetDifficulty)
    if (distA !== distB) return distA - distB
    return a.index - b.index
  })

  return unanswered[0].index
}
