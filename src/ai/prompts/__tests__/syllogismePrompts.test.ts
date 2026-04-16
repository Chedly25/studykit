import { describe, it, expect } from 'vitest'
import {
  buildSyllogismeScenarioPrompt,
  buildSyllogismeGradingPrompt,
  SYLLOGISME_THEMES,
} from '../syllogismePrompts'
import type { SyllogismeTask, SyllogismeSubmission } from '../../coaching/types'

function makeTask(): SyllogismeTask {
  return {
    theme: 'Responsabilité contractuelle',
    difficulty: 'beginner',
    scenario: 'Marie a commandé une table. Quatre mois plus tard, rien n\'est livré.',
    question: 'Marie peut-elle obtenir des dommages et intérêts ?',
    sourceArticles: [
      { articleNum: '1231-1', codeName: 'Code civil', text: 'Le débiteur est condamné...' },
    ],
    modelSyllogisme: {
      majeure: {
        article: 'Art. 1231-1 C. civ.',
        rule: 'Le débiteur d\'une obligation est tenu de réparer.',
        elements: ['Obligation du débiteur', 'Inexécution', 'Absence de force majeure', 'Préjudice'],
      },
      mineure: {
        factMappings: [
          { element: 'Obligation du débiteur', fact: 'Le contrat oblige Meubles+ à livrer' },
          { element: 'Inexécution', fact: 'Quatre mois sans livraison' },
        ],
      },
      conclusion: {
        answer: 'Oui, Marie peut obtenir des dommages et intérêts.',
        justification: 'Toutes les conditions sont réunies.',
      },
    },
    generatedAt: '2026-04-16T00:00:00.000Z',
  }
}

function makeSubmission(overrides: Partial<SyllogismeSubmission> = {}): SyllogismeSubmission {
  return {
    majeure: 'Selon l\'article 1231-1...',
    mineure: 'Marie a commandé, rien livré...',
    conclusion: 'Donc oui.',
    submittedAt: '2026-04-16T00:05:00.000Z',
    ...overrides,
  }
}

describe('buildSyllogismeScenarioPrompt', () => {
  it('returns non-empty system and user strings', () => {
    const result = buildSyllogismeScenarioPrompt({
      theme: 'Responsabilité contractuelle',
      difficulty: 'beginner',
      articles: [],
    })
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(100)
    expect(result.user.length).toBeGreaterThan(100)
  })

  it('includes CRFPA + syllogisme context in system', () => {
    const { system } = buildSyllogismeScenarioPrompt({
      theme: 'X', difficulty: 'beginner', articles: [],
    })
    expect(system).toContain('CRFPA')
    expect(system).toContain('syllogisme')
    expect(system).toContain('majeure')
    expect(system).toContain('mineure')
    expect(system).toContain('conclusion')
  })

  it('instructs strict JSON output with no emojis', () => {
    const { system, user } = buildSyllogismeScenarioPrompt({
      theme: 'X', difficulty: 'beginner', articles: [],
    })
    expect(system).toContain('Aucun emoji')
    expect(system).toContain('JSON')
    expect(user).toContain('JSON strict')
  })

  it('echoes the theme and difficulty in the user prompt', () => {
    const result = buildSyllogismeScenarioPrompt({
      theme: 'Licenciement économique',
      difficulty: 'intermediate',
      articles: [],
    })
    expect(result.user).toContain('Licenciement économique')
    expect(result.user).toContain('intermediate')
  })

  it('includes pre-fetched articles in the user prompt', () => {
    const result = buildSyllogismeScenarioPrompt({
      theme: 'X',
      difficulty: 'beginner',
      articles: [
        { articleNum: '1231-1', codeName: 'Code civil', text: 'Le débiteur est condamné...' },
      ],
    })
    expect(result.user).toContain('1231-1')
    expect(result.user).toContain('Code civil')
    expect(result.user).toContain('Le débiteur est condamné')
  })

  it('includes avoid clause when avoidScenarios is non-empty', () => {
    const result = buildSyllogismeScenarioPrompt({
      theme: 'X',
      difficulty: 'beginner',
      articles: [],
      avoidScenarios: ['Marie a commandé une table...'],
    })
    expect(result.user).toContain('Évite les scénarios suivants')
    expect(result.user).toContain('Marie a commandé une table')
  })

  it('omits avoid clause when avoidScenarios is empty', () => {
    const result = buildSyllogismeScenarioPrompt({
      theme: 'X', difficulty: 'beginner', articles: [],
    })
    expect(result.user).not.toContain('Évite les scénarios suivants')
  })

  const difficulties: Array<'beginner' | 'intermediate' | 'advanced'> = ['beginner', 'intermediate', 'advanced']
  for (const difficulty of difficulties) {
    it(`works for difficulty ${difficulty}`, () => {
      const result = buildSyllogismeScenarioPrompt({
        theme: 'X', difficulty, articles: [],
      })
      expect(result.user).toContain(difficulty)
    })
  }
})

describe('buildSyllogismeGradingPrompt', () => {
  it('returns non-empty system and user strings', () => {
    const result = buildSyllogismeGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(result.system.length).toBeGreaterThan(100)
    expect(result.user.length).toBeGreaterThan(100)
  })

  it('grades pedagogically — system forbids giving the answer', () => {
    const { system } = buildSyllogismeGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(system).toContain('PÉDAGOGIQUE')
    expect(system).toMatch(/n'écris JAMAIS à la place de l'étudiant/)
  })

  it('forbids emojis and requires strict JSON', () => {
    const { system } = buildSyllogismeGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(system).toContain('Aucun emoji')
    expect(system).toContain('JSON')
  })

  it('echoes the task scenario and question', () => {
    const { user } = buildSyllogismeGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(user).toContain('Marie a commandé une table')
    expect(user).toContain('Marie peut-elle obtenir des dommages')
  })

  it('echoes the student submission in the user prompt', () => {
    const { user } = buildSyllogismeGradingPrompt({
      task: makeTask(),
      submission: makeSubmission({ majeure: 'MA_MAJEURE', mineure: 'MA_MINEURE', conclusion: 'MA_CONCLUSION' }),
    })
    expect(user).toContain('MA_MAJEURE')
    expect(user).toContain('MA_MINEURE')
    expect(user).toContain('MA_CONCLUSION')
  })

  it('marks empty submission sections as "(vide)"', () => {
    const { user } = buildSyllogismeGradingPrompt({
      task: makeTask(),
      submission: makeSubmission({ majeure: '', mineure: '', conclusion: '' }),
    })
    expect(user).toContain('(vide)')
  })

  it('includes the JSON rubric schema keys', () => {
    const { user } = buildSyllogismeGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(user).toContain('articleCorrect')
    expect(user).toContain('elementsIdentified')
    expect(user).toContain('mappings')
    expect(user).toContain('topMistake')
    expect(user).toContain('strength')
  })
})

describe('SYLLOGISME_THEMES', () => {
  it('has at least 10 themes', () => {
    expect(SYLLOGISME_THEMES.length).toBeGreaterThanOrEqual(10)
  })

  it('each theme has id, label, domain, and non-empty searchSeeds', () => {
    for (const theme of SYLLOGISME_THEMES) {
      expect(theme.id).toBeTruthy()
      expect(theme.label).toBeTruthy()
      expect(['civil', 'social', 'penal', 'administratif', 'commercial']).toContain(theme.domain)
      expect(Array.isArray(theme.searchSeeds)).toBe(true)
      expect(theme.searchSeeds.length).toBeGreaterThan(0)
    }
  })

  it('covers multiple legal domains', () => {
    const domains = new Set(SYLLOGISME_THEMES.map(t => t.domain))
    expect(domains.size).toBeGreaterThanOrEqual(3)
  })

  it('has unique ids', () => {
    const ids = SYLLOGISME_THEMES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
