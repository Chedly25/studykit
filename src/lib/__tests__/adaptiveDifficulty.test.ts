import { describe, it, expect } from 'vitest'
import {
  createAdaptiveState,
  updateAdaptiveState,
  getNextQuestionIndex,
} from '../adaptiveDifficulty'
import type { GeneratedQuestion } from '../../db/schema'

function makeQuestion(difficulty: number): GeneratedQuestion {
  return { id: 'q', sessionId: 's', difficulty } as GeneratedQuestion
}

describe('createAdaptiveState', () => {
  it('returns default state', () => {
    const state = createAdaptiveState()
    expect(state.correctStreak).toBe(0)
    expect(state.incorrectStreak).toBe(0)
    expect(state.targetDifficulty).toBe(3)
    expect(state.answeredIndices.size).toBe(0)
  })
})

describe('updateAdaptiveState', () => {
  it('increments correctStreak on correct answer', () => {
    const state = createAdaptiveState()
    const next = updateAdaptiveState(state, true, 0)
    expect(next.correctStreak).toBe(1)
    expect(next.incorrectStreak).toBe(0)
    expect(next.answeredIndices.has(0)).toBe(true)
  })

  it('increases difficulty after 3 correct in a row', () => {
    let state = createAdaptiveState()
    state = updateAdaptiveState(state, true, 0)
    state = updateAdaptiveState(state, true, 1)
    state = updateAdaptiveState(state, true, 2)
    expect(state.targetDifficulty).toBe(4)
    expect(state.correctStreak).toBe(0) // resets
  })

  it('caps difficulty at 5', () => {
    let state = { ...createAdaptiveState(), targetDifficulty: 5 }
    state = updateAdaptiveState(state, true, 0)
    state = updateAdaptiveState(state, true, 1)
    state = updateAdaptiveState(state, true, 2)
    expect(state.targetDifficulty).toBe(5)
  })

  it('increments incorrectStreak on wrong answer', () => {
    const state = createAdaptiveState()
    const next = updateAdaptiveState(state, false, 0)
    expect(next.incorrectStreak).toBe(1)
    expect(next.correctStreak).toBe(0)
  })

  it('decreases difficulty after 2 wrong in a row', () => {
    let state = createAdaptiveState()
    state = updateAdaptiveState(state, false, 0)
    state = updateAdaptiveState(state, false, 1)
    expect(state.targetDifficulty).toBe(2)
    expect(state.incorrectStreak).toBe(0) // resets
  })

  it('floors difficulty at 1', () => {
    let state = { ...createAdaptiveState(), targetDifficulty: 1 }
    state = updateAdaptiveState(state, false, 0)
    state = updateAdaptiveState(state, false, 1)
    expect(state.targetDifficulty).toBe(1)
  })

  it('resets correctStreak on wrong answer', () => {
    let state = createAdaptiveState()
    state = updateAdaptiveState(state, true, 0)
    state = updateAdaptiveState(state, true, 1)
    state = updateAdaptiveState(state, false, 2)
    expect(state.correctStreak).toBe(0)
  })
})

describe('getNextQuestionIndex', () => {
  it('picks closest difficulty to target', () => {
    const questions = [makeQuestion(1), makeQuestion(3), makeQuestion(5)]
    const state = { ...createAdaptiveState(), targetDifficulty: 3 }
    expect(getNextQuestionIndex(questions, state, -1)).toBe(1)
  })

  it('skips answered questions', () => {
    const questions = [makeQuestion(3), makeQuestion(3), makeQuestion(5)]
    const state = { ...createAdaptiveState(), targetDifficulty: 3, answeredIndices: new Set([0, 1]) }
    expect(getNextQuestionIndex(questions, state, -1)).toBe(2)
  })

  it('returns -1 when all questions answered', () => {
    const questions = [makeQuestion(3)]
    const state = { ...createAdaptiveState(), answeredIndices: new Set([0]) }
    expect(getNextQuestionIndex(questions, state, 0)).toBe(-1)
  })

  it('stays on current if only one left', () => {
    const questions = [makeQuestion(3), makeQuestion(5)]
    const state = { ...createAdaptiveState(), answeredIndices: new Set([1]) }
    expect(getNextQuestionIndex(questions, state, 0)).toBe(0)
  })

  it('breaks ties by index for stability', () => {
    const questions = [makeQuestion(3), makeQuestion(3)]
    const state = createAdaptiveState()
    expect(getNextQuestionIndex(questions, state, -1)).toBe(0)
  })
})
