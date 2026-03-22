/**
 * Additional goalDecomposer tests — unknown action normalization,
 * diagnostic report in prompt, steps without description filtered.
 */
import { describe, it, expect, vi } from 'vitest'
import { decomposeGoal, formatPlanForPrompt } from '../goalDecomposer'
import type { LlmFn } from '../../agents/types'
import type { Topic } from '../../../db/schema'

const mockTopics: Topic[] = [
  { id: 't1', subjectId: 's1', examProfileId: 'p1', name: 'Probability', mastery: 0.3, confidence: 0.4, questionsAttempted: 10, questionsCorrect: 3, easeFactor: 2.5, interval: 5, repetitions: 2, nextReviewDate: '' },
]

describe('decomposeGoal — additional', () => {
  it('normalizes unknown step actions to teach', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue(JSON.stringify({
      isComplex: true, goal: 'Study',
      steps: [{ action: 'unknownAction', topic: 'Math', description: 'Do something', tools: [] }],
    }))
    const result = await decomposeGoal('Help me prepare for my exam in two weeks', mockTopics, null, llm)
    expect(result!.steps[0].action).toBe('teach')
  })

  it('filters out steps without description', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue(JSON.stringify({
      isComplex: true, goal: 'Study',
      steps: [
        { action: 'teach', topic: 'A', description: '', tools: [] },
        { action: 'teach', topic: 'B', description: 'Real step', tools: [] },
      ],
    }))
    const result = await decomposeGoal('Help me prepare for my exam', mockTopics, null, llm)
    expect(result!.steps).toHaveLength(1)
    expect(result!.steps[0].topic).toBe('B')
  })

  it('returns null when all steps are filtered out', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue(JSON.stringify({
      isComplex: true, goal: 'Study',
      steps: [{ action: 'teach', topic: 'A', description: '', tools: [] }],
    }))
    const result = await decomposeGoal('Help me prepare for my exam', mockTopics, null, llm)
    expect(result).toBeNull()
  })

  it('includes diagnostic priorities in LLM prompt', async () => {
    const llm: LlmFn = vi.fn().mockResolvedValue('{ "isComplex": false }')
    const report = { priorities: [{ topicName: 'Critical Topic', urgency: 'critical' }] } as any
    await decomposeGoal('Help me prepare for my big exam next month', mockTopics, report, llm)
    expect(llm).toHaveBeenCalledWith(
      expect.stringContaining('Critical Topic'),
      expect.any(String),
    )
  })

  it('formatPlanForPrompt handles step without topic', () => {
    const plan = {
      goal: 'Study', isComplex: true,
      steps: [{ action: 'diagnose' as const, topic: '', description: 'Check overall status', tools: [] }],
    }
    const result = formatPlanForPrompt(plan)
    expect(result).toContain('[diagnose]')
    expect(result).toContain('Check overall status')
    expect(result).not.toContain('(topic:')
  })
})
