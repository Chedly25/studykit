import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/knowledgeGraph', () => ({
  computeReadiness: vi.fn(() => 65),
  computeStreak: vi.fn(() => ({ streak: 3, freezeUsed: false })),
  computeWeeklyHours: vi.fn(() => 12),
  decayedMastery: vi.fn((t: { mastery: number }) => t.mastery * 0.95),
}))

import {
  buildSystemPrompt,
  buildSourceSection,
  buildSocraticPrompt,
  buildExplainBackPrompt,
  buildResearchSystemPrompt,
  buildWritingPartnerPrompt,
  buildSessionPrompt,
} from '../systemPrompt'
import type { PromptContext, SessionContext } from '../systemPrompt'

function makeProfile(overrides = {}) {
  return {
    id: 'p1',
    userId: 'u1',
    name: 'Test Exam',
    examType: 'university-course' as const,
    profileMode: 'exam' as const,
    examDate: '2026-06-01',
    passingThreshold: 70,
    weeklyTargetHours: 15,
    createdAt: '2025-01-01',
    ...overrides,
  }
}

function makeTopic(overrides = {}) {
  return {
    id: 't1',
    profileId: 'p1',
    subjectId: 's1',
    name: 'Test Topic',
    mastery: 0.5,
    confidence: 0.5,
    questionsAttempted: 10,
    questionsCorrect: 7,
    lastStudied: '2026-04-01',
    status: null,
    prerequisiteTopicIds: null,
    ...overrides,
  }
}

function makeSubject(overrides = {}) {
  return {
    id: 's1',
    profileId: 'p1',
    name: 'Test Subject',
    weight: 1,
    mastery: 0.5,
    ...overrides,
  }
}

function makeCtx(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    profile: makeProfile(),
    subjects: [makeSubject()],
    topics: [makeTopic()],
    dailyLogs: [],
    dueFlashcardCount: 5,
    upcomingAssignments: [],
    ...overrides,
  }
}

describe('buildSystemPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08'))
  })

  it('returns a non-empty string for university-course profile', () => {
    const result = buildSystemPrompt(makeCtx())
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(100)
  })

  it('includes profile name and exam type', () => {
    const result = buildSystemPrompt(makeCtx())
    expect(result).toContain('Test Exam')
    expect(result).toContain('university-course')
  })

  it('includes readiness and streak data', () => {
    const result = buildSystemPrompt(makeCtx())
    expect(result).toContain('Readiness: 65%')
    expect(result).toContain('3 day study streak')
  })

  it('includes flashcard count', () => {
    const result = buildSystemPrompt(makeCtx())
    expect(result).toContain('5 flashcards due')
  })

  it('handles professional-exam type', () => {
    const result = buildSystemPrompt(makeCtx({ profile: makeProfile({ examType: 'professional-exam' }) }))
    expect(result).toContain('professional-exam')
    expect(result).toContain('multiple choice and scenario-based')
  })

  it('handles graduate-research type', () => {
    const result = buildSystemPrompt(makeCtx({ profile: makeProfile({ examType: 'graduate-research' }) }))
    expect(result).toContain('graduate-research')
  })

  it('handles language-learning type', () => {
    const result = buildSystemPrompt(makeCtx({ profile: makeProfile({ examType: 'language-learning' }) }))
    expect(result).toContain('language-learning')
  })

  it('handles empty profile (no subjects, no topics)', () => {
    const result = buildSystemPrompt(makeCtx({ subjects: [], topics: [] }))
    expect(result).toContain('none yet')
    expect(result).toContain('CRITICAL')
  })

  it('handles profile without exam date', () => {
    const result = buildSystemPrompt(makeCtx({ profile: makeProfile({ examDate: null }) }))
    expect(result).not.toContain('days left')
  })

  it('includes upcoming assignments', () => {
    const result = buildSystemPrompt(makeCtx({
      upcomingAssignments: [
        { id: 'a1', profileId: 'p1', title: 'Homework 1', dueDate: '2026-04-15', priority: 'high', status: 'pending', description: '', createdAt: '' },
      ],
    }))
    expect(result).toContain('Homework 1')
    expect(result).toContain('high priority')
  })

  it('includes source section when sourceContext is provided', () => {
    const result = buildSystemPrompt(makeCtx({
      sourceContext: { documentCount: 3 },
    }))
    expect(result).toContain('Uploaded Sources')
    expect(result).toContain('3 documents')
  })

  it('includes language section for non-English', () => {
    const result = buildSystemPrompt(makeCtx({ language: 'fr' }))
    expect(result).toContain('French')
  })

  it('does not include language section for English', () => {
    const result = buildSystemPrompt(makeCtx({ language: 'en' }))
    expect(result).not.toContain('Respond in')
  })

  it('includes tutor preferences when provided', () => {
    const result = buildSystemPrompt(makeCtx({
      tutorPreferences: {
        id: 'tp1',
        profileId: 'p1',
        teachingStyle: 'concise',
        explanationApproach: 'analogies-first',
        feedbackTone: 'encouraging',
        languageLevel: 'beginner-friendly',
      },
    }))
    expect(result).toContain('Tutor Persona')
    expect(result).toContain('brief and to the point')
  })

  it('includes student model when provided', () => {
    const result = buildSystemPrompt(makeCtx({
      studentModel: {
        id: 'sm1',
        profileId: 'p1',
        learningStyle: '{"visual": true}',
        commonMistakes: '["Confuses A with B"]',
        personalityNotes: '["Shy learner"]',
        preferredExplanations: '["Uses analogies"]',
        motivationTriggers: '["Likes challenges"]',
        updatedAt: '',
      },
    }))
    expect(result).toContain('Student Profile (Observed)')
    expect(result).toContain('visual')
  })

  it('includes exam formats when provided', () => {
    const result = buildSystemPrompt(makeCtx({
      examFormats: [
        { id: 'ef1', profileId: 'p1', formatName: 'MCQ Section', timeAllocation: 60, pointWeight: 40, questionCount: 30, description: '', createdAt: '' },
      ],
    }))
    expect(result).toContain('Exam Format')
    expect(result).toContain('MCQ Section')
  })

  it('includes exam intelligence when provided', () => {
    const result = buildSystemPrompt(makeCtx({
      profile: makeProfile({
        examIntelligence: JSON.stringify({
          overview: 'This is a tough exam',
          totalDuration: 180,
          passingScore: 65,
          tips: ['Study early', 'Focus on weak areas'],
        }),
      }),
    }))
    expect(result).toContain('Exam Intelligence')
    expect(result).toContain('This is a tough exam')
    expect(result).toContain('Study early')
  })

  it('includes calibration section for topics with enough data', () => {
    const result = buildSystemPrompt(makeCtx({
      topics: [
        makeTopic({ name: 'Overconfident', mastery: 0.3, confidence: 0.8, questionsAttempted: 5 }),
        makeTopic({ id: 't2', name: 'Underconfident', mastery: 0.8, confidence: 0.3, questionsAttempted: 5 }),
      ],
    }))
    expect(result).toContain('Confidence Calibration')
  })

  it('includes topic dependency section', () => {
    const result = buildSystemPrompt(makeCtx({
      topics: [
        makeTopic({ id: 't1', name: 'Advanced Topic', prerequisiteTopicIds: ['t2'] }),
        makeTopic({ id: 't2', name: 'Basic Topic' }),
      ],
    }))
    expect(result).toContain('Topic Dependencies')
  })

  it('caps prompt at max length', () => {
    const result = buildSystemPrompt(makeCtx())
    expect(result.length).toBeLessThanOrEqual(12_000 + 60) // small buffer for truncation message
  })

  it('delegates to research prompt for research profile', () => {
    const result = buildSystemPrompt(makeCtx({
      profile: makeProfile({ profileMode: 'research' }),
    }))
    expect(result).toContain('research advisor')
  })
})

describe('buildSourceSection', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns section with document count', () => {
    const result = buildSourceSection({ documentCount: 5 })
    expect(result).toContain('5 documents')
    expect(result).toContain('Citation Instructions')
  })

  it('handles singular document', () => {
    const result = buildSourceSection({ documentCount: 1 })
    expect(result).toContain('1 document')
    expect(result).not.toContain('1 documents')
  })

  it('includes pre-retrieved chunks when provided', () => {
    const result = buildSourceSection({ documentCount: 2, preRetrievedChunks: 'Some relevant content...' })
    expect(result).toContain('Relevant Source Context')
    expect(result).toContain('Some relevant content...')
  })
})

describe('buildSocraticPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08'))
  })

  it('includes Socratic mode section', () => {
    const result = buildSocraticPrompt(makeCtx(), 'Algebra')
    expect(result).toContain('SOCRATIC MODE ACTIVE')
    expect(result).toContain('Algebra')
    expect(result).toContain('NEVER give the answer directly')
  })
})

describe('buildExplainBackPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08'))
  })

  it('includes Explain-Back mode section', () => {
    const result = buildExplainBackPrompt(makeCtx(), 'Calculus')
    expect(result).toContain('EXPLAIN-BACK MODE ACTIVE')
    expect(result).toContain('Calculus')
    expect(result).toContain('Completeness')
    expect(result).toContain('Accuracy')
    expect(result).toContain('Clarity')
  })
})

describe('buildResearchSystemPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08'))
  })

  it('returns research-specific prompt', () => {
    const result = buildResearchSystemPrompt(makeCtx({
      profile: makeProfile({ profileMode: 'research' }),
    }))
    expect(result).toContain('research advisor')
    expect(result).toContain('Research Project')
    expect(result).toContain('Research Threads')
  })

  it('categorizes topics by status', () => {
    const result = buildResearchSystemPrompt(makeCtx({
      profile: makeProfile({ profileMode: 'research' }),
      topics: [
        makeTopic({ name: 'Active Thread', status: 'active' }),
        makeTopic({ id: 't2', name: 'Blocked Thread', status: 'blocked' }),
      ],
    }))
    expect(result).toContain('Active')
    expect(result).toContain('Blocked')
  })

  it('includes optional sections for research mode', () => {
    const result = buildResearchSystemPrompt(makeCtx({
      profile: makeProfile({ profileMode: 'research' }),
      conversationSummaries: [
        { id: 'cs1', profileId: 'p1', sessionDate: '2026-04-07', topicsCovered: '["ML basics"]', keyOutcomes: '["Reviewed backprop"]', messageCount: 5, createdAt: '' },
      ],
      flashcardPerformance: [
        { deckName: 'ML Deck', cardCount: 20, retentionRate: 85, dueCount: 3, averageEaseFactor: 2.5 },
      ],
    }))
    expect(result).toContain('Recent Session History')
    expect(result).toContain('Flashcard Performance')
    expect(result).toContain('ML Deck')
  })
})

describe('buildWritingPartnerPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08'))
  })

  it('includes writing partner section for research profile', () => {
    const result = buildWritingPartnerPrompt(makeCtx({
      profile: makeProfile({ profileMode: 'research' }),
    }))
    expect(result).toContain('WRITING PARTNER MODE ACTIVE')
    expect(result).toContain('clarity, argument structure')
  })

  it('includes writing partner section for exam profile', () => {
    const result = buildWritingPartnerPrompt(makeCtx())
    expect(result).toContain('WRITING PARTNER MODE ACTIVE')
  })
})

describe('buildSessionPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08'))
  })

  function makeSession(overrides: Partial<SessionContext> = {}): SessionContext {
    return {
      topicName: 'Algebra',
      subjectName: 'Mathematics',
      mastery: 0.6,
      decayedMastery: 0.55,
      lastStudied: '2026-04-05',
      questionsAttempted: 20,
      questionsCorrect: 15,
      dueFlashcards: 3,
      ...overrides,
    }
  }

  it('includes session-specific details', () => {
    const result = buildSessionPrompt(makeCtx(), makeSession())
    expect(result).toContain('STUDY SESSION ACTIVE')
    expect(result).toContain('Algebra')
    expect(result).toContain('Mathematics')
    expect(result).toContain('60%')
    expect(result).toContain('55%')
    expect(result).toContain('75% correct')
    expect(result).toContain('3 flashcards due')
  })

  it('handles session with no prior study', () => {
    const result = buildSessionPrompt(makeCtx(), makeSession({ lastStudied: null, questionsAttempted: 0, questionsCorrect: 0 }))
    expect(result).toContain('has not been studied before')
    expect(result).toContain('no questions attempted yet')
  })

  it('includes chapter name when provided', () => {
    const result = buildSessionPrompt(makeCtx(), makeSession({ chapterName: 'Chapter 3' }))
    expect(result).toContain('Chapter 3')
  })

  it('includes exercise stats when provided', () => {
    const result = buildSessionPrompt(makeCtx(), makeSession({ exerciseStats: { total: 10, completed: 5, avgScore: 0.8 } }))
    expect(result).toContain('5/10 exercises completed')
    expect(result).toContain('80%')
  })

  it('includes sibling topics when provided', () => {
    const result = buildSessionPrompt(makeCtx(), makeSession({ siblingTopics: ['Geometry', 'Calculus'] }))
    expect(result).toContain('Geometry')
    expect(result).toContain('Calculus')
  })

  it('includes existing card titles and warns not to re-teach', () => {
    const result = buildSessionPrompt(makeCtx(), makeSession({ existingCardTitles: ['Vectors', 'Matrices'] }))
    expect(result).toContain('Vectors')
    expect(result).toContain('Do NOT re-teach')
  })

  it('includes exam-type guidance for university-course', () => {
    const result = buildSessionPrompt(makeCtx(), makeSession())
    expect(result).toContain('EXAM-TYPE GUIDANCE')
    expect(result).toContain('university course')
  })

  it('includes exam-type guidance for professional-exam', () => {
    const result = buildSessionPrompt(
      makeCtx({ profile: makeProfile({ examType: 'professional-exam' }) }),
      makeSession(),
    )
    expect(result).toContain('professional exam')
    expect(result).toContain('scenario-based')
  })
})
