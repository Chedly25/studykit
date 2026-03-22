import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('../systemPrompt', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('BASE PROMPT'),
}))

vi.mock('../memory/episodicMemory', () => ({
  recallEpisodes: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../db', () => ({
  db: {
    misconceptions: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    },
  },
}))

import { buildAdaptivePrompt } from '../adaptivePrompt'
import { recallEpisodes } from '../memory/episodicMemory'
import type { AdaptivePromptContext } from '../adaptivePrompt'

const mockRecall = vi.mocked(recallEpisodes)

function makeCtx(overrides: Partial<AdaptivePromptContext> = {}): AdaptivePromptContext {
  return {
    profile: { id: 'p1', name: 'Test', examType: 'custom', examDate: '', isActive: true, passingThreshold: 70, weeklyTargetHours: 10, createdAt: '', userId: 'u1' },
    subjects: [],
    topics: [],
    dailyLogs: [],
    dueFlashcardCount: 0,
    upcomingAssignments: [],
    userId: 'u1',
    ...overrides,
  } as AdaptivePromptContext
}

describe('buildAdaptivePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRecall.mockResolvedValue([])
  })

  it('returns base prompt when no student model or episodes', async () => {
    const result = await buildAdaptivePrompt(makeCtx())
    expect(result).toContain('BASE PROMPT')
  })

  it('appends student-aware rules when commonMistakes exist', async () => {
    const result = await buildAdaptivePrompt(makeCtx({
      studentModel: {
        id: 'p1', examProfileId: 'p1',
        learningStyle: '{}',
        commonMistakes: '["rushes to answer", "confuses X and Y"]',
        personalityNotes: '["needs encouragement"]',
        preferredExplanations: '["analogies-first"]',
        motivationTriggers: '[]',
        updatedAt: '',
      },
    }))
    expect(result).toContain('Adaptive Teaching Rules')
    expect(result).toContain('rush')
    expect(result).toContain('positive reinforcement')
    expect(result).toContain('analogies')
  })

  it('appends episodic memory when effective episodes exist', async () => {
    mockRecall
      .mockResolvedValueOnce([{
        id: 'e1', userId: 'u1', type: 'strategy-effective',
        description: 'Step-by-step derivation worked well',
        topicName: 'Calculus', effectiveness: 0.9,
        context: '{}', tags: '[]', createdAt: '', updatedAt: '',
      }])
      .mockResolvedValueOnce([{
        id: 'e2', userId: 'u1', type: 'strategy-ineffective',
        description: 'Abstract definitions confused the student',
        topicName: 'Algebra', effectiveness: 0.2,
        context: '{}', tags: '[]', createdAt: '', updatedAt: '',
      }])

    const result = await buildAdaptivePrompt(makeCtx())
    expect(result).toContain('What Has Worked Before')
    expect(result).toContain('Step-by-step derivation')
    expect(result).toContain('What Has NOT Worked')
    expect(result).toContain('Abstract definitions')
  })

  it('handles errors gracefully — returns base prompt', async () => {
    mockRecall.mockRejectedValue(new Error('DB error'))
    const result = await buildAdaptivePrompt(makeCtx())
    expect(result).toContain('BASE PROMPT')
  })
})
