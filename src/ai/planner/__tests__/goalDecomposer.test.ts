import { describe, it, expect, vi } from 'vitest'
import { decomposeGoal, formatPlanForPrompt } from '../goalDecomposer'
import type { LlmFn } from '../../agents/types'
import type { Topic } from '../../../db/schema'

const mockTopics: Topic[] = [
  { id: 't1', subjectId: 's1', examProfileId: 'p1', name: 'Probability', mastery: 0.3, confidence: 0.4, questionsAttempted: 10, questionsCorrect: 3, easeFactor: 2.5, interval: 5, repetitions: 2, nextReviewDate: '' },
  { id: 't2', subjectId: 's1', examProfileId: 'p1', name: 'Statistics', mastery: 0.7, confidence: 0.6, questionsAttempted: 20, questionsCorrect: 14, easeFactor: 2.5, interval: 10, repetitions: 3, nextReviewDate: '' },
]

describe('decomposeGoal', () => {
  it('returns null for simple short questions', async () => {
    const llm: LlmFn = vi.fn()
    const result = await decomposeGoal('What is a derivative?', mockTopics, null, llm)
    expect(result).toBeNull()
    expect(llm).not.toHaveBeenCalled()
  })

  it('decomposes complex study goals', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue(JSON.stringify({
      isComplex: true,
      goal: 'Prepare for statistics exam',
      steps: [
        { action: 'diagnose', topic: 'Probability', description: 'Assess current knowledge', tools: ['getWeakTopics'] },
        { action: 'teach', topic: 'Probability', description: 'Review key concepts', tools: ['renderConceptCard'] },
        { action: 'practice', topic: 'Statistics', description: 'Practice with quiz', tools: ['renderQuiz'] },
      ],
    }))

    const result = await decomposeGoal('Help me prepare for my statistics exam next week', mockTopics, null, llm)
    expect(result).not.toBeNull()
    expect(result!.isComplex).toBe(true)
    expect(result!.steps).toHaveLength(3)
    expect(result!.steps[0].action).toBe('diagnose')
  })

  it('returns null when LLM says not complex', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue('{ "isComplex": false }')
    const result = await decomposeGoal('Help me prepare for my exam please I need to study everything', mockTopics, null, llm)
    expect(result).toBeNull()
  })

  it('handles LLM failure gracefully', async () => {
    const llm: LlmFn = vi.fn().mockRejectedValue(new Error('API error'))
    const result = await decomposeGoal('Help me prepare for my statistics exam', mockTopics, null, llm)
    expect(result).toBeNull()
  })

  it('detects goal keywords in short messages', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue('{ "isComplex": true, "goal": "Review", "steps": [{ "action": "diagnose", "topic": "All", "description": "Check status", "tools": [] }] }')
    const result = await decomposeGoal('Help me study', mockTopics, null, llm)
    // "study" is a goal keyword, so LLM should be called despite short message
    expect(llm).toHaveBeenCalled()
  })

  it('caps steps at 5', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue(JSON.stringify({
      isComplex: true,
      goal: 'Big goal',
      steps: Array.from({ length: 10 }, (_, i) => ({
        action: 'teach', topic: `Topic ${i}`, description: `Step ${i}`, tools: [],
      })),
    }))

    const result = await decomposeGoal('Help me prepare for my exam covering all 10 topics this semester', mockTopics, null, llm)
    expect(result!.steps).toHaveLength(5)
  })
})

describe('formatPlanForPrompt', () => {
  it('formats plan as system prompt addendum', () => {
    const plan = {
      goal: 'Prepare for exam',
      isComplex: true,
      steps: [
        { action: 'diagnose' as const, topic: 'Math', description: 'Check knowledge', tools: [] },
        { action: 'teach' as const, topic: 'Math', description: 'Review concepts', tools: [] },
      ],
    }
    const result = formatPlanForPrompt(plan)
    expect(result).toContain('Session Plan')
    expect(result).toContain('Step 1')
    expect(result).toContain('[diagnose]')
    expect(result).toContain('Check knowledge')
  })
})
