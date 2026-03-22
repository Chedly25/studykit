import { describe, it, expect, vi } from 'vitest'
import { evaluateFlashcardBatch, evaluateConceptCard } from '../evaluator'
import type { LlmFn } from '../../agents/types'

describe('evaluateFlashcardBatch', () => {
  it('returns evaluations for each card', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue(JSON.stringify({
      evaluations: [
        { index: 0, score: 0.9, redundancyScore: 0, action: 'keep', issues: [] },
        { index: 1, score: 0.2, redundancyScore: 0.9, action: 'discard', issues: ['duplicate'] },
      ],
    }))

    const cards = [
      { front: 'What is X?', back: 'X is Y' },
      { front: 'Define X', back: 'X means Y' },
    ]
    const result = await evaluateFlashcardBatch(cards, [{ front: 'Define X', back: 'Y' }], llm)

    expect(result).toHaveLength(2)
    expect(result[0].action).toBe('keep')
    expect(result[1].action).toBe('discard')
  })

  it('returns default evaluations on LLM failure', async () => {
    const llm: LlmFn = vi.fn().mockRejectedValue(new Error('fail'))
    const cards = [{ front: 'Q', back: 'A' }]
    const result = await evaluateFlashcardBatch(cards, [], llm)

    expect(result).toHaveLength(1)
    expect(result[0].action).toBe('keep') // default
  })

  it('returns empty for empty input', async () => {
    const llm: LlmFn = vi.fn()
    const result = await evaluateFlashcardBatch([], [], llm)
    expect(result).toHaveLength(0)
    expect(llm).not.toHaveBeenCalled()
  })

  it('handles malformed JSON gracefully', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue('not json')
    const cards = [{ front: 'Q', back: 'A' }]
    const result = await evaluateFlashcardBatch(cards, [], llm)
    expect(result).toHaveLength(1)
    expect(result[0].action).toBe('keep') // fallback
  })
})

describe('evaluateConceptCard', () => {
  it('discards duplicate titles without LLM call', async () => {
    const llm: LlmFn = vi.fn()
    const result = await evaluateConceptCard(
      { title: 'Algebra', content: 'content', keyPoints: [] },
      [{ title: 'Algebra' }],
      llm,
    )
    expect(result.action).toBe('discard')
    expect(result.redundancyScore).toBe(1)
    expect(llm).not.toHaveBeenCalled()
  })

  it('evaluates non-duplicate cards via LLM', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue('{ "score": 0.85, "action": "keep", "issues": [], "redundancyScore": 0 }')
    const result = await evaluateConceptCard(
      { title: 'New Topic', content: 'detailed content', keyPoints: ['p1'] },
      [{ title: 'Different Topic' }],
      llm,
    )
    expect(result.action).toBe('keep')
    expect(result.score).toBe(0.85)
  })

  it('handles LLM failure gracefully', async () => {
    const llm: LlmFn = vi.fn().mockRejectedValue(new Error('fail'))
    const result = await evaluateConceptCard(
      { title: 'Topic', content: 'content', keyPoints: [] },
      [],
      llm,
    )
    expect(result.action).toBe('keep') // default
    expect(result.score).toBe(0.5)
  })
})
