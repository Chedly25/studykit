/**
 * Additional evaluator tests — rewrite action, case-insensitive duplicate,
 * out-of-range score clamping.
 */
import { describe, it, expect, vi } from 'vitest'
import { evaluateFlashcardBatch, evaluateConceptCard } from '../evaluator'
import type { LlmFn } from '../../agents/types'

describe('evaluateFlashcardBatch — additional', () => {
  it('passes rewrite action through correctly', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue(JSON.stringify({
      evaluations: [{ index: 0, score: 0.45, redundancyScore: 0.2, action: 'rewrite', issues: ['too vague'] }],
    }))
    const result = await evaluateFlashcardBatch([{ front: 'Q', back: 'A' }], [], llm)
    expect(result[0].action).toBe('rewrite')
    expect(result[0].issues).toContain('too vague')
  })

  it('clamps out-of-range scores to 0-1', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue(JSON.stringify({
      evaluations: [{ index: 0, score: 1.5, redundancyScore: -0.3, action: 'keep', issues: [] }],
    }))
    const result = await evaluateFlashcardBatch([{ front: 'Q', back: 'A' }], [], llm)
    expect(result[0].score).toBe(1)
    expect(result[0].redundancyScore).toBe(0)
  })
})

describe('evaluateConceptCard — additional', () => {
  it('detects duplicate titles case-insensitively', async () => {
    const llm: LlmFn = vi.fn()
    const result = await evaluateConceptCard(
      { title: 'algebra basics', content: 'content', keyPoints: [] },
      [{ title: 'Algebra Basics' }],
      llm,
    )
    expect(result.action).toBe('discard')
    expect(result.redundancyScore).toBe(1)
    expect(llm).not.toHaveBeenCalled()
  })

  it('handles malformed JSON from LLM gracefully', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue('not valid json at all')
    const result = await evaluateConceptCard(
      { title: 'New Topic', content: 'content', keyPoints: [] },
      [],
      llm,
    )
    expect(result.action).toBe('keep') // default
    expect(result.score).toBe(0.5)
  })
})
