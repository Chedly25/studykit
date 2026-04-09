import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ──────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  dbAgentInsightsGet: vi.fn(),
  dbAgentInsightsPut: vi.fn(),
  dbExamProfilesGet: vi.fn(),
}))

vi.mock('../../../../db', () => ({
  db: {
    agentInsights: {
      get: (...args: unknown[]) => mocks.dbAgentInsightsGet(...args),
      put: (...args: unknown[]) => mocks.dbAgentInsightsPut(...args),
    },
    examProfiles: {
      get: (...args: unknown[]) => mocks.dbExamProfilesGet(...args),
    },
  },
}))

import { generateMorningBriefing } from '../morningBriefing'

// ─── Helpers ────────────────────────────────────────────────
const PROFILE_ID = 'exam-profile-1'

function makeLlm(response: string = '{}') {
  return vi.fn().mockResolvedValue(response)
}

function makeDiagnosticData(overrides = {}) {
  return {
    readiness: { score: 72 },
    priorities: [
      { topic: 'Droit constitutionnel', urgency: 'high', reason: 'Weak area needing focus' },
      { topic: 'Economie', urgency: 'normal', reason: 'Good progress but needs maintenance' },
    ],
    ...overrides,
  }
}

function makeEngagementData(overrides = {}) {
  return {
    burnoutRisk: 0.15,
    avgSessionMinutes: 45,
    sessionTrend: 'stable',
    ...overrides,
  }
}

function makeActivityData() {
  return [
    { action: 'autopilot-sweep', summary: 'Ran: scout, eval. Skipped: forge.' },
  ]
}

function makeValidLlmResponse() {
  return JSON.stringify({
    focusRecommendation: 'Concentre-toi sur le droit constitutionnel.',
    overnightSummary: 'Le systeme a analyse tes resultats recents.',
    readinessTrend: 'improving',
    topActions: [
      { action: 'Revise droit constitutionnel', priority: 'high', route: '/queue' },
    ],
  })
}

// ─── Setup ──────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-07-10T08:00:00Z'))

  // Default: no existing data
  mocks.dbAgentInsightsGet.mockResolvedValue(null)
  mocks.dbAgentInsightsPut.mockResolvedValue(undefined)
  mocks.dbExamProfilesGet.mockResolvedValue(null)
})

// ─── Tests ──────────────────────────────────────────────────
describe('generateMorningBriefing', () => {
  it('generates briefing with correct structure', async () => {
    const llm = makeLlm(makeValidLlmResponse())

    // Set up data for gathering
    mocks.dbAgentInsightsGet.mockImplementation(async (key: string) => {
      if (key === `autopilot-briefing:${PROFILE_ID}`) return null
      if (key === `diagnostician:${PROFILE_ID}`) return { data: JSON.stringify(makeDiagnosticData()) }
      if (key === `progress-monitor:${PROFILE_ID}`) return null
      if (key === `engagement-monitor:${PROFILE_ID}`) return { data: JSON.stringify(makeEngagementData()) }
      if (key === `swarm-activity-log:${PROFILE_ID}`) return { data: JSON.stringify(makeActivityData()) }
      return null
    })

    const result = await generateMorningBriefing(PROFILE_ID, llm)

    expect(result).not.toBeNull()
    expect(result!.date).toBe('2024-07-10')
    expect(result!.readinessScore).toBe(72)
    expect(result!.readinessTrend).toBe('improving')
    expect(result!.focusRecommendation).toBe('Concentre-toi sur le droit constitutionnel.')
    expect(result!.overnightSummary).toBe('Le systeme a analyse tes resultats recents.')
    expect(result!.topActions).toHaveLength(1)
    expect(result!.topActions[0].priority).toBe('high')
    expect(result!.contentGenerated).toEqual({ conceptCards: 0, flashcards: 0, exercises: 0 })
    expect(result!.dismissed).toBe(false)
    expect(result!.generatedAt).toBeTruthy()
  })

  it('is idempotent — does not regenerate if today\'s briefing exists', async () => {
    const existingBriefing = {
      date: '2024-07-10', // today
      readinessScore: 72,
      readinessTrend: 'stable',
      topActions: [],
      overnightSummary: 'Already generated',
      contentGenerated: { conceptCards: 0, flashcards: 0, exercises: 0 },
      focusRecommendation: 'Focus on math',
      engagementStatus: 'Good',
      daysUntilExam: 30,
      generatedAt: '2024-07-10T06:00:00Z',
      dismissed: false,
    }

    mocks.dbAgentInsightsGet.mockImplementation(async (key: string) => {
      if (key === `autopilot-briefing:${PROFILE_ID}`) {
        return { data: JSON.stringify(existingBriefing) }
      }
      return null
    })

    const llm = makeLlm(makeValidLlmResponse())
    const result = await generateMorningBriefing(PROFILE_ID, llm)

    expect(result).not.toBeNull()
    expect(result!.focusRecommendation).toBe('Focus on math') // returned existing
    expect(llm).not.toHaveBeenCalled() // no LLM call
    expect(mocks.dbAgentInsightsPut).not.toHaveBeenCalled()
  })

  it('regenerates if briefing is from yesterday', async () => {
    const yesterdayBriefing = {
      date: '2024-07-09', // yesterday
      readinessScore: 60,
      readinessTrend: 'stable',
      topActions: [],
      overnightSummary: 'Old briefing',
      contentGenerated: { conceptCards: 0, flashcards: 0, exercises: 0 },
      focusRecommendation: 'Old focus',
      engagementStatus: 'Ok',
      daysUntilExam: null,
      generatedAt: '2024-07-09T07:00:00Z',
      dismissed: false,
    }

    mocks.dbAgentInsightsGet.mockImplementation(async (key: string) => {
      if (key === `autopilot-briefing:${PROFILE_ID}`) {
        return { data: JSON.stringify(yesterdayBriefing), createdAt: '2024-07-09T07:00:00Z' }
      }
      return null
    })

    const llm = makeLlm(makeValidLlmResponse())
    const result = await generateMorningBriefing(PROFILE_ID, llm)

    expect(llm).toHaveBeenCalled() // LLM was called to regenerate
    expect(result).not.toBeNull()
    expect(result!.date).toBe('2024-07-10') // new date
  })

  it('handles missing diagnostic data gracefully', async () => {
    // All data sources return null
    mocks.dbAgentInsightsGet.mockResolvedValue(null)
    mocks.dbExamProfilesGet.mockResolvedValue(null)

    const llm = makeLlm(makeValidLlmResponse())
    const result = await generateMorningBriefing(PROFILE_ID, llm)

    expect(result).not.toBeNull()
    expect(result!.readinessScore).toBe(0) // default when no diagnostic data
    expect(llm).toHaveBeenCalled()

    // Verify the prompt included fallback text
    const prompt = llm.mock.calls[0][0] as string
    expect(prompt).toContain('No diagnostic data available')
  })

  it('handles LLM parse failure gracefully (returns null)', async () => {
    const llm = makeLlm('This is not valid JSON at all, just random text')

    const result = await generateMorningBriefing(PROFILE_ID, llm)

    expect(result).toBeNull()
  })

  it('handles LLM throwing an error gracefully (returns null)', async () => {
    const llm = vi.fn().mockRejectedValue(new Error('LLM service unavailable'))

    const result = await generateMorningBriefing(PROFILE_ID, llm)

    expect(result).toBeNull()
  })

  it('stores briefing in agentInsights', async () => {
    const llm = makeLlm(makeValidLlmResponse())

    await generateMorningBriefing(PROFILE_ID, llm)

    expect(mocks.dbAgentInsightsPut).toHaveBeenCalled()
    const putCall = mocks.dbAgentInsightsPut.mock.calls[0][0]
    expect(putCall.id).toBe(`autopilot-briefing:${PROFILE_ID}`)
    expect(putCall.agentId).toBe('autopilot')
    expect(putCall.examProfileId).toBe(PROFILE_ID)

    const storedData = JSON.parse(putCall.data)
    expect(storedData.date).toBe('2024-07-10')
    expect(storedData.focusRecommendation).toBeTruthy()
    expect(putCall.summary).toContain('Morning briefing:')
  })

  it('includes daysUntilExam when profile has exam date', async () => {
    mocks.dbExamProfilesGet.mockResolvedValue({
      examDate: '2024-08-10T00:00:00Z', // 31 days from 2024-07-10
    })

    const llm = makeLlm(makeValidLlmResponse())
    const result = await generateMorningBriefing(PROFILE_ID, llm)

    expect(result).not.toBeNull()
    expect(result!.daysUntilExam).toBeGreaterThan(0)
    expect(typeof result!.daysUntilExam).toBe('number')
  })

  it('daysUntilExam is null when no exam date', async () => {
    mocks.dbExamProfilesGet.mockResolvedValue({ examDate: null })

    const llm = makeLlm(makeValidLlmResponse())
    const result = await generateMorningBriefing(PROFILE_ID, llm)

    expect(result).not.toBeNull()
    expect(result!.daysUntilExam).toBeNull()
  })

  it('daysUntilExam is null when no profile found', async () => {
    mocks.dbExamProfilesGet.mockResolvedValue(null)

    const llm = makeLlm(makeValidLlmResponse())
    const result = await generateMorningBriefing(PROFILE_ID, llm)

    expect(result).not.toBeNull()
    expect(result!.daysUntilExam).toBeNull()
  })

  it('daysUntilExam is 0 when exam date is today', async () => {
    mocks.dbExamProfilesGet.mockResolvedValue({
      examDate: '2024-07-10T00:00:00Z', // today
    })

    const llm = makeLlm(makeValidLlmResponse())
    const result = await generateMorningBriefing(PROFILE_ID, llm)

    expect(result).not.toBeNull()
    expect(result!.daysUntilExam).toBe(0)
  })

  it('extracts JSON from LLM response wrapped in text', async () => {
    const wrappedResponse = `Voici le briefing:
${makeValidLlmResponse()}
Bonne journee!`

    const llm = makeLlm(wrappedResponse)
    const result = await generateMorningBriefing(PROFILE_ID, llm)

    expect(result).not.toBeNull()
    expect(result!.readinessTrend).toBe('improving')
  })

  it('preserves existing createdAt when updating briefing record', async () => {
    const existingCreatedAt = '2024-07-05T06:00:00Z'
    mocks.dbAgentInsightsGet.mockImplementation(async (key: string) => {
      if (key === `autopilot-briefing:${PROFILE_ID}`) {
        return {
          data: JSON.stringify({ date: '2024-07-09' }), // yesterday
          createdAt: existingCreatedAt,
        }
      }
      return null
    })

    const llm = makeLlm(makeValidLlmResponse())
    await generateMorningBriefing(PROFILE_ID, llm)

    const putCall = mocks.dbAgentInsightsPut.mock.calls[0][0]
    expect(putCall.createdAt).toBe(existingCreatedAt)
  })
})
