import { describe, it, expect } from 'vitest'
import {
  buildCasPratiqueGenerationPrompt,
  buildCasPratiqueGradingPrompt,
  buildCasPratiqueVerificationPrompt,
  SPECIALTY_OPTIONS,
  SPECIALTY_SEARCH_SEEDS,
} from '../casPratiquePrompts'
import type {
  CasPratiquePromptConfig,
  CasPratiqueSpecialty,
} from '../casPratiquePrompts'
import type {
  CasPratiqueGroundingEntry,
  CasPratiqueSubmission,
  CasPratiqueTask,
} from '../../coaching/types'

const SAMPLE_POOL: CasPratiqueGroundingEntry[] = [
  {
    articleNum: '1231-1',
    codeName: 'Code civil',
    breadcrumb: 'Livre III, Titre III',
    text: 'Le débiteur est condamné, s\'il y a lieu, au paiement de dommages-intérêts...',
  },
  {
    articleNum: '1240',
    codeName: 'Code civil',
    breadcrumb: 'Livre III, Titre III',
    text: 'Tout fait quelconque de l\'homme, qui cause à autrui un dommage...',
  },
]

function makeConfig(overrides: Partial<CasPratiquePromptConfig> = {}): CasPratiquePromptConfig {
  return {
    specialty: 'obligations',
    duration: 180,
    groundingPool: SAMPLE_POOL,
    ...overrides,
  }
}

function makeTask(overrides: Partial<CasPratiqueTask> = {}): CasPratiqueTask {
  return {
    specialty: 'obligations',
    specialtyLabel: 'Droit des obligations',
    duration: 180,
    scenario: 'M. Dupont vous consulte...',
    modelAnswer: 'Sur le fondement de l\'article 1231-1 du code civil...',
    legalIssues: ['Responsabilité contractuelle', 'Vice du consentement'],
    groundingPool: SAMPLE_POOL,
    generatedAt: '2026-04-23T10:00:00.000Z',
    ...overrides,
  }
}

function makeSubmission(overrides: Partial<CasPratiqueSubmission> = {}): CasPratiqueSubmission {
  return {
    answer: 'Je pense que...',
    submittedAt: '2026-04-23T11:00:00.000Z',
    ...overrides,
  }
}

describe('buildCasPratiqueGenerationPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildCasPratiqueGenerationPrompt(makeConfig())
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(100)
  })

  it('includes CRFPA context', () => {
    const result = buildCasPratiqueGenerationPrompt(makeConfig())
    expect(result.system).toContain('CRFPA')
    expect(result.system).toContain('consultation juridique')
  })

  it('includes duration', () => {
    const result = buildCasPratiqueGenerationPrompt(makeConfig({ duration: 120 }))
    expect(result.system).toContain('120 minutes')
  })

  it('includes topics when provided', () => {
    const result = buildCasPratiqueGenerationPrompt(makeConfig({ topics: ['Responsabilité civile'] }))
    expect(result.user).toContain('Responsabilité civile')
  })

  it('includes avoidThemes when provided', () => {
    const result = buildCasPratiqueGenerationPrompt(makeConfig({ avoidThemes: ['Vice du consentement'] }))
    expect(result.user).toContain('Vice du consentement')
  })

  it('works without optional fields', () => {
    const result = buildCasPratiqueGenerationPrompt(makeConfig())
    expect(result.system).toBeTruthy()
    expect(result.user).toBeTruthy()
  })

  it('injects the grounding pool into the system prompt', () => {
    const result = buildCasPratiqueGenerationPrompt(makeConfig())
    expect(result.system).toContain('SOURCES AUTORISÉES')
    expect(result.system).toContain('1231-1')
    expect(result.system).toContain('1240')
    expect(result.system).toContain('Code civil')
  })

  it('includes citation rules in the system prompt', () => {
    const result = buildCasPratiqueGenerationPrompt(makeConfig())
    expect(result.system).toContain('Règles de citation ABSOLUES')
  })

  it('surfaces previousFailures when provided', () => {
    const result = buildCasPratiqueGenerationPrompt(makeConfig({
      previousFailures: ['Art. 1131 inventé', 'Cass. 12 mars 2019 fictif'],
    }))
    expect(result.system).toContain('Art. 1131 inventé')
    expect(result.system).toContain('Cass. 12 mars 2019 fictif')
    expect(result.system).toContain('CORRECTIONS À APPORTER')
  })

  const specialties: CasPratiqueSpecialty[] = [
    'obligations', 'civil', 'penal', 'affaires', 'social',
    'administratif', 'fiscal', 'immobilier',
    'procedure-civile', 'procedure-penale', 'procedure-administrative',
  ]

  for (const specialty of specialties) {
    it(`generates valid prompt for specialty ${specialty}`, () => {
      const result = buildCasPratiqueGenerationPrompt(makeConfig({ specialty }))
      expect(result.system.length).toBeGreaterThan(100)
      expect(result.user.length).toBeGreaterThan(50)
      expect(result.system).toContain('DOMAINES COUVERTS')
    })
  }

  it('emits legalIssues shape in the output spec', () => {
    const result = buildCasPratiqueGenerationPrompt(makeConfig())
    expect(result.system).toContain('legalIssues')
  })
})

describe('buildCasPratiqueGradingPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildCasPratiqueGradingPrompt({
      task: makeTask(),
      submission: makeSubmission(),
    })
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(100)
  })

  it('includes the 6 axes with correct max scores', () => {
    const result = buildCasPratiqueGradingPrompt({
      task: makeTask(),
      submission: makeSubmission(),
    })
    expect(result.user).toContain('identification (/4)')
    expect(result.user).toContain('syllogisme (/5)')
    expect(result.user).toContain('regles (/4)')
    expect(result.user).toContain('application (/3)')
    expect(result.user).toContain('redaction (/2)')
    expect(result.user).toContain('conseil (/2)')
  })

  it('requires JSON-only output', () => {
    const result = buildCasPratiqueGradingPrompt({
      task: makeTask(),
      submission: makeSubmission(),
    })
    expect(result.system).toContain('UNIQUEMENT du JSON')
  })

  it('forbids emojis', () => {
    const result = buildCasPratiqueGradingPrompt({
      task: makeTask(),
      submission: makeSubmission(),
    })
    expect(result.system).toContain('Aucun emoji')
  })

  it('includes the scenario', () => {
    const result = buildCasPratiqueGradingPrompt({
      task: makeTask({ scenario: 'UNIQUE_SCENARIO_MARKER' }),
      submission: makeSubmission(),
    })
    expect(result.user).toContain('UNIQUE_SCENARIO_MARKER')
  })

  it('includes the student submission', () => {
    const result = buildCasPratiqueGradingPrompt({
      task: makeTask(),
      submission: makeSubmission({ answer: 'UNIQUE_SUBMISSION_MARKER' }),
    })
    expect(result.user).toContain('UNIQUE_SUBMISSION_MARKER')
  })

  it('replaces empty submission with placeholder', () => {
    const result = buildCasPratiqueGradingPrompt({
      task: makeTask(),
      submission: makeSubmission({ answer: '   ' }),
    })
    expect(result.user).toContain('(vide)')
  })

  it('numbers the legal issues for index-based reference', () => {
    const result = buildCasPratiqueGradingPrompt({
      task: makeTask({ legalIssues: ['Premier problème', 'Deuxième problème', 'Troisième problème'] }),
      submission: makeSubmission(),
    })
    expect(result.user).toContain('0. Premier problème')
    expect(result.user).toContain('1. Deuxième problème')
    expect(result.user).toContain('2. Troisième problème')
  })

  it('exposes the grounding pool to the grader', () => {
    const result = buildCasPratiqueGradingPrompt({
      task: makeTask(),
      submission: makeSubmission(),
    })
    expect(result.user).toContain('POOL DE RÉFÉRENCES')
    expect(result.user).toContain('1231-1')
  })

  it('requires identifiedIssues + missedIssues in overall', () => {
    const result = buildCasPratiqueGradingPrompt({
      task: makeTask(),
      submission: makeSubmission(),
    })
    expect(result.user).toContain('identifiedIssues')
    expect(result.user).toContain('missedIssues')
  })

  it('penalises invented references on the regles axis', () => {
    const result = buildCasPratiqueGradingPrompt({
      task: makeTask(),
      submission: makeSubmission(),
    })
    expect(result.system).toContain('inventées')
  })
})

describe('buildCasPratiqueVerificationPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildCasPratiqueVerificationPrompt({
      groundingPool: SAMPLE_POOL,
      modelAnswer: 'Sur le fondement de l\'article 1231-1...',
      scenario: 'M. Dupont...',
    })
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('requires JSON-only output', () => {
    const result = buildCasPratiqueVerificationPrompt({
      groundingPool: SAMPLE_POOL,
      modelAnswer: 'x',
      scenario: 'y',
    })
    expect(result.system).toContain('UNIQUEMENT du JSON')
  })

  it('exposes the pool and the model answer to the verifier', () => {
    const result = buildCasPratiqueVerificationPrompt({
      groundingPool: SAMPLE_POOL,
      modelAnswer: 'UNIQUE_MODEL_MARKER',
      scenario: 'UNIQUE_SCENARIO_MARKER',
    })
    expect(result.user).toContain('UNIQUE_MODEL_MARKER')
    expect(result.user).toContain('UNIQUE_SCENARIO_MARKER')
    expect(result.user).toContain('1231-1')
  })

  it('defines both severity levels', () => {
    const result = buildCasPratiqueVerificationPrompt({
      groundingPool: SAMPLE_POOL,
      modelAnswer: 'x',
      scenario: 'y',
    })
    expect(result.system).toContain('FABRIQUÉ')
    expect(result.system).toContain('DÉNATURÉE')
  })
})

describe('SPECIALTY_OPTIONS', () => {
  it('has 11 options', () => {
    expect(SPECIALTY_OPTIONS).toHaveLength(11)
  })

  it('each has value, label, and category', () => {
    for (const opt of SPECIALTY_OPTIONS) {
      expect(opt.value).toBeTruthy()
      expect(opt.label).toBeTruthy()
      expect(['obligations', 'specialite', 'procedure']).toContain(opt.category)
    }
  })

  it('has exactly one obligations category', () => {
    const obligations = SPECIALTY_OPTIONS.filter(o => o.category === 'obligations')
    expect(obligations).toHaveLength(1)
  })

  it('has procedure categories', () => {
    const procedures = SPECIALTY_OPTIONS.filter(o => o.category === 'procedure')
    expect(procedures.length).toBeGreaterThanOrEqual(3)
  })
})

describe('SPECIALTY_SEARCH_SEEDS', () => {
  it('covers every specialty', () => {
    for (const opt of SPECIALTY_OPTIONS) {
      expect(SPECIALTY_SEARCH_SEEDS[opt.value]).toBeDefined()
      expect(SPECIALTY_SEARCH_SEEDS[opt.value].length).toBeGreaterThanOrEqual(3)
    }
  })

  it('seeds are non-empty strings', () => {
    for (const seeds of Object.values(SPECIALTY_SEARCH_SEEDS)) {
      for (const s of seeds) {
        expect(typeof s).toBe('string')
        expect(s.length).toBeGreaterThan(5)
      }
    }
  })
})
