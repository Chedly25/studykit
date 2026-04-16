import { describe, it, expect } from 'vitest'
import {
  buildPlanQuestionPrompt,
  buildPlanGradingPrompt,
  PLAN_THEMES,
} from '../planPrompts'
import type { PlanTask, PlanSubmission } from '../../coaching/types'

function makeTask(): PlanTask {
  return {
    question: 'La force obligatoire du contrat',
    themeLabel: 'Droit des contrats',
    sourceArticles: [
      { articleNum: '1103', codeName: 'Code civil', text: 'Les contrats légalement formés...' },
    ],
    modelPlan: {
      problematique: 'Tension entre intangibilité et atténuation.',
      I: { title: 'Un principe consacré', IA: 'Autonomie de la volonté', IB: 'Bonne foi' },
      II: { title: 'Un principe tempéré', IIA: 'Protection du contractant faible', IIB: 'Imprévision' },
      transitions: { I_to_II: 'Le principe demeure mais les correctifs se multiplient.' },
      anchors: {
        IA: 'Art. 1103 C. civ.',
        IB: 'Art. 1104 C. civ.',
        IIA: 'Art. 1171 C. civ.',
        IIB: 'Art. 1195 C. civ.',
      },
    },
    commonPitfalls: [
      'Traiter le sujet de manière descriptive.',
      'Oublier la réforme de 2016.',
    ],
    generatedAt: '2026-04-16T00:00:00.000Z',
  }
}

function makeSubmission(overrides: Partial<PlanSubmission> = {}): PlanSubmission {
  return {
    problematique: 'Le contrat est-il intangible ?',
    I: { title: 'Principe', IA: 'Art. 1103', IB: 'Bonne foi' },
    II: { title: 'Exceptions', IIA: 'Clauses abusives', IIB: 'Imprévision' },
    submittedAt: '2026-04-16T00:05:00.000Z',
    ...overrides,
  }
}

describe('buildPlanQuestionPrompt', () => {
  it('returns non-empty system and user strings', () => {
    const result = buildPlanQuestionPrompt({
      themeId: 'force-obligatoire',
      themeLabel: 'Droit des contrats',
      articles: [],
    })
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(100)
    expect(result.user.length).toBeGreaterThan(100)
  })

  it('includes CRFPA + dissertation + problématique context', () => {
    const { system, user } = buildPlanQuestionPrompt({
      themeId: 'x', themeLabel: 'X', articles: [],
    })
    expect(system).toContain('CRFPA')
    expect(system).toContain('dissertation')
    expect(user).toContain('problematique')
  })

  it('forbids emojis and requires strict JSON', () => {
    const { system, user } = buildPlanQuestionPrompt({
      themeId: 'x', themeLabel: 'X', articles: [],
    })
    expect(system).toContain('Aucun emoji')
    expect(system).toContain('JSON')
    expect(user).toContain('JSON strict')
  })

  it('echoes the theme label in the user prompt', () => {
    const result = buildPlanQuestionPrompt({
      themeId: 'x', themeLabel: 'Droit des contrats', articles: [],
    })
    expect(result.user).toContain('Droit des contrats')
  })

  it('includes pre-fetched articles', () => {
    const result = buildPlanQuestionPrompt({
      themeId: 'x',
      themeLabel: 'X',
      articles: [
        { articleNum: '1103', codeName: 'Code civil', text: 'Les contrats légalement formés...' },
      ],
    })
    expect(result.user).toContain('1103')
    expect(result.user).toContain('Code civil')
    expect(result.user).toContain('Les contrats légalement formés')
  })

  it('includes avoid clause when avoidQuestions is non-empty', () => {
    const result = buildPlanQuestionPrompt({
      themeId: 'x',
      themeLabel: 'X',
      articles: [],
      avoidQuestions: ['La force obligatoire du contrat'],
    })
    expect(result.user).toContain('Évite les sujets suivants')
    expect(result.user).toContain('La force obligatoire du contrat')
  })

  it('omits avoid clause when avoidQuestions is empty', () => {
    const result = buildPlanQuestionPrompt({
      themeId: 'x', themeLabel: 'X', articles: [],
    })
    expect(result.user).not.toContain('Évite les sujets suivants')
  })

  it('requires commonPitfalls in the output schema', () => {
    const result = buildPlanQuestionPrompt({
      themeId: 'x', themeLabel: 'X', articles: [],
    })
    expect(result.user).toContain('commonPitfalls')
  })
})

describe('buildPlanGradingPrompt', () => {
  it('returns non-empty system and user strings', () => {
    const result = buildPlanGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(result.system.length).toBeGreaterThan(100)
    expect(result.user.length).toBeGreaterThan(100)
  })

  it('grades pedagogically — system forbids giving the answer', () => {
    const { system } = buildPlanGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(system).toContain('PÉDAGOGIQUE')
    expect(system).toMatch(/n'écris JAMAIS à la place du candidat/)
  })

  it('forbids emojis and requires strict JSON', () => {
    const { system } = buildPlanGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(system).toContain('Aucun emoji')
    expect(system).toContain('JSON')
  })

  it('echoes the question and theme', () => {
    const { user } = buildPlanGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(user).toContain('La force obligatoire du contrat')
    expect(user).toContain('Droit des contrats')
  })

  it('echoes all 7 student fields', () => {
    const { user } = buildPlanGradingPrompt({
      task: makeTask(),
      submission: makeSubmission({
        problematique: 'MA_PROBLEMATIQUE',
        I: { title: 'TITLE_I', IA: 'IA_STUDENT', IB: 'IB_STUDENT' },
        II: { title: 'TITLE_II', IIA: 'IIA_STUDENT', IIB: 'IIB_STUDENT' },
      }),
    })
    expect(user).toContain('MA_PROBLEMATIQUE')
    expect(user).toContain('TITLE_I')
    expect(user).toContain('IA_STUDENT')
    expect(user).toContain('IB_STUDENT')
    expect(user).toContain('TITLE_II')
    expect(user).toContain('IIA_STUDENT')
    expect(user).toContain('IIB_STUDENT')
  })

  it('marks empty fields as "(vide)"', () => {
    const { user } = buildPlanGradingPrompt({
      task: makeTask(),
      submission: makeSubmission({
        problematique: '',
        I: { title: '', IA: '', IB: '' },
        II: { title: '', IIA: '', IIB: '' },
      }),
    })
    expect(user).toContain('(vide)')
  })

  it('includes all 6 axis keys', () => {
    const { user } = buildPlanGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(user).toContain('problematique')
    expect(user).toContain('opposition')
    expect(user).toContain('equilibre')
    expect(user).toContain('chevauchement')
    expect(user).toContain('couverture')
    expect(user).toContain('transitions')
  })

  it('includes topMistake and strength in overall schema', () => {
    const { user } = buildPlanGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(user).toContain('topMistake')
    expect(user).toContain('strength')
  })

  it('echoes the common pitfalls from task', () => {
    const { user } = buildPlanGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(user).toContain('Oublier la réforme de 2016')
  })
})

describe('PLAN_THEMES', () => {
  it('has at least 8 entries', () => {
    expect(PLAN_THEMES.length).toBeGreaterThanOrEqual(8)
  })

  it('each theme has id, label, domain, non-empty searchSeeds', () => {
    for (const theme of PLAN_THEMES) {
      expect(theme.id).toBeTruthy()
      expect(theme.label).toBeTruthy()
      expect(['civil', 'social', 'penal', 'administratif', 'constitutionnel', 'europeen']).toContain(theme.domain)
      expect(Array.isArray(theme.searchSeeds)).toBe(true)
      expect(theme.searchSeeds.length).toBeGreaterThan(0)
    }
  })

  it('covers at least 3 distinct domains', () => {
    const domains = new Set(PLAN_THEMES.map(t => t.domain))
    expect(domains.size).toBeGreaterThanOrEqual(3)
  })

  it('has unique ids', () => {
    const ids = PLAN_THEMES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
