import { describe, it, expect, vi } from 'vitest'
import { reflect } from '../reflectionLoop'
import type { Validator, LlmFn } from '../../agents/types'

function makeValidator<T>(overrides: Partial<Validator<T>> = {}): Validator<T> {
  return {
    name: 'test',
    minScore: 0.7,
    maxAttempts: 2,
    validate: vi.fn().mockResolvedValue({ score: 0.9, issues: [], suggestions: [] }),
    buildFixPrompt: vi.fn().mockReturnValue('fix this'),
    parseFixed: vi.fn().mockImplementation((_raw: string, original: T) => original),
    ...overrides,
  }
}

describe('reflect', () => {
  it('returns immediately if initial score meets threshold', async () => {
    const llm: LlmFn = vi.fn()
    const validator = makeValidator<string>({
      validate: vi.fn().mockResolvedValue({ score: 0.9, issues: [], suggestions: [] }),
    })

    const result = await reflect('good content', validator, llm)
    expect(result.score).toBe(0.9)
    expect(result.wasFixed).toBe(false)
    expect(result.attempts).toBe(1)
    expect(validator.validate).toHaveBeenCalledTimes(1)
    expect(llm).not.toHaveBeenCalled()
  })

  it('runs fix loop when score is below threshold', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue('{"fixed": true}')
    const validator = makeValidator<string>({
      validate: vi.fn()
        .mockResolvedValueOnce({ score: 0.4, issues: ['too short'], suggestions: ['add detail'] })
        .mockResolvedValueOnce({ score: 0.8, issues: [], suggestions: [] }),
      buildFixPrompt: vi.fn().mockReturnValue('fix prompt'),
      parseFixed: vi.fn().mockReturnValue('fixed content'),
    })

    const result = await reflect('bad content', validator, llm)
    expect(result.score).toBe(0.8)
    expect(result.wasFixed).toBe(true)
    expect(result.attempts).toBe(2)
    expect(llm).toHaveBeenCalledTimes(1) // 1 fix call
  })

  it('stops after maxAttempts even if still below threshold', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue('attempted fix')
    const validator = makeValidator<string>({
      maxAttempts: 2,
      validate: vi.fn().mockResolvedValue({ score: 0.3, issues: ['still bad'], suggestions: ['try harder'] }),
      parseFixed: vi.fn().mockReturnValue('still bad content'),
    })

    const result = await reflect('bad content', validator, llm)
    expect(result.score).toBe(0.3)
    expect(result.attempts).toBe(3) // initial + 2 fix attempts
    expect(llm).toHaveBeenCalledTimes(2) // 2 fix calls
  })

  it('keeps best score even if later attempt is worse', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue('fix attempt')
    const validator = makeValidator<string>({
      maxAttempts: 2,
      validate: vi.fn()
        .mockResolvedValueOnce({ score: 0.4, issues: ['issue'], suggestions: ['fix'] })
        .mockResolvedValueOnce({ score: 0.6, issues: [], suggestions: [] }) // improvement
        .mockResolvedValueOnce({ score: 0.5, issues: [], suggestions: [] }), // regression
      parseFixed: vi.fn()
        .mockReturnValueOnce('better')
        .mockReturnValueOnce('worse'),
    })

    const result = await reflect('content', validator, llm)
    // Should keep 0.6 (best seen), not regress to 0.5
    expect(result.score).toBe(0.6)
    expect(result.content).toBe('better')
  })

  it('returns wasFixed=false when fix attempt does not improve', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue('same thing')
    const original = { value: 'original' }
    const validator = makeValidator<typeof original>({
      maxAttempts: 1,
      validate: vi.fn().mockResolvedValue({ score: 0.3, issues: ['bad'], suggestions: [] }),
      parseFixed: vi.fn().mockReturnValue(original), // returns same reference
    })

    const result = await reflect(original, validator, llm)
    expect(result.wasFixed).toBe(false) // reference equality check
  })
})
