import { describe, it, expect } from 'vitest'
import { buildCasPratiqueGenerationPrompt, SPECIALTY_OPTIONS } from '../casPratiquePrompts'
import type { CasPratiquePromptConfig, CasPratiqueSpecialty } from '../casPratiquePrompts'

function makeConfig(overrides: Partial<CasPratiquePromptConfig> = {}): CasPratiquePromptConfig {
  return {
    specialty: 'obligations',
    duration: 180,
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
      // Each specialty should mention its domains
      expect(result.system).toContain('DOMAINES COUVERTS')
    })
  }

  it('includes JSON structure for response', () => {
    const result = buildCasPratiqueGenerationPrompt(makeConfig())
    expect(result.system).toContain('scenario')
    expect(result.system).toContain('modelAnswer')
    expect(result.system).toContain('rubric')
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
