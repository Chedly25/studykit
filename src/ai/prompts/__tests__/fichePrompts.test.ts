import { describe, it, expect } from 'vitest'
import { buildFicheGenerationPrompt } from '../fichePrompts'
import type { FichePromptConfig } from '../fichePrompts'

function makeConfig(overrides: Partial<FichePromptConfig> = {}): FichePromptConfig {
  return {
    topicName: 'Espaces vectoriels',
    subjectName: 'Algèbre linéaire',
    examName: 'Concours Mines-Ponts',
    mastery: 0.65,
    courseContent: 'Un espace vectoriel est un ensemble muni de deux lois...',
    conceptCards: [],
    personalMistakes: [],
    language: 'fr',
    ...overrides,
  }
}

describe('buildFicheGenerationPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildFicheGenerationPrompt(makeConfig())
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(100)
  })

  describe('French language', () => {
    it('system prompt is in French', () => {
      const result = buildFicheGenerationPrompt(makeConfig({ language: 'fr' }))
      expect(result.system).toContain('FICHES DE RÉVISION')
      expect(result.system).toContain('professeur agrégé')
    })

    it('includes French section headers', () => {
      const result = buildFicheGenerationPrompt(makeConfig({ language: 'fr' }))
      expect(result.user).toContain('Définitions')
      expect(result.user).toContain('Théorèmes clés')
      expect(result.user).toContain('Méthodes')
      expect(result.user).toContain('Erreurs fréquentes')
    })

    it('includes topic and subject', () => {
      const result = buildFicheGenerationPrompt(makeConfig({ language: 'fr' }))
      expect(result.user).toContain('Espaces vectoriels')
      expect(result.user).toContain('Algèbre linéaire')
    })

    it('includes mastery level', () => {
      const result = buildFicheGenerationPrompt(makeConfig({ mastery: 0.45 }))
      expect(result.user).toContain('45%')
    })
  })

  describe('English language', () => {
    it('system prompt is in English', () => {
      const result = buildFicheGenerationPrompt(makeConfig({ language: 'en' }))
      expect(result.system).toContain('REVISION SHEETS')
      expect(result.system).toContain('expert teacher')
    })

    it('includes English section headers', () => {
      const result = buildFicheGenerationPrompt(makeConfig({ language: 'en' }))
      expect(result.user).toContain('Definitions')
      expect(result.user).toContain('Key Theorems')
      expect(result.user).toContain('Methods')
      expect(result.user).toContain('Common Mistakes')
    })
  })

  it('includes course content when provided', () => {
    const result = buildFicheGenerationPrompt(makeConfig({ courseContent: 'Important theorem about...' }))
    expect(result.user).toContain('Important theorem about...')
  })

  it('handles empty course content', () => {
    const result = buildFicheGenerationPrompt(makeConfig({ courseContent: '' }))
    expect(result.user).not.toContain('CONTENU DU COURS')
  })

  it('includes concept cards when provided', () => {
    const result = buildFicheGenerationPrompt(makeConfig({
      conceptCards: [
        { title: 'Base canonique', content: 'Content...', mastery: 0.8 },
        { title: 'Dimension', content: 'Content...', mastery: 0.6 },
      ],
    }))
    expect(result.user).toContain('Base canonique')
    expect(result.user).toContain('80%')
    expect(result.user).toContain('Dimension')
  })

  it('includes personal mistakes when provided', () => {
    const result = buildFicheGenerationPrompt(makeConfig({
      personalMistakes: ['Confuses dimension and rank', 'Forgets to check linear independence'],
    }))
    expect(result.user).toContain('Confuses dimension and rank')
    expect(result.user).toContain('Forgets to check linear independence')
    expect(result.user).toContain('OBLIGATOIRE')
  })

  it('handles empty personal mistakes', () => {
    const result = buildFicheGenerationPrompt(makeConfig({ personalMistakes: [] }))
    expect(result.user).not.toContain('ERREURS PERSONNELLES')
  })

  it('includes exam name in system prompt', () => {
    const result = buildFicheGenerationPrompt(makeConfig({ examName: 'CRFPA 2026' }))
    expect(result.system).toContain('CRFPA 2026')
  })

  it('user prompt starts with topic name at the end', () => {
    const result = buildFicheGenerationPrompt(makeConfig())
    expect(result.user).toContain('# Espaces vectoriels')
  })

  it('includes concept cards section in English', () => {
    const result = buildFicheGenerationPrompt(makeConfig({
      language: 'en',
      conceptCards: [{ title: 'Basis', content: '...', mastery: 0.7 }],
    }))
    expect(result.user).toContain('CONCEPTS ALREADY STUDIED')
    expect(result.user).toContain('70%')
    expect(result.user).toContain('mastered')
  })

  it('includes personal mistakes section in English', () => {
    const result = buildFicheGenerationPrompt(makeConfig({
      language: 'en',
      personalMistakes: ['Forgot condition'],
    }))
    expect(result.user).toContain('PERSONAL MISTAKES')
    expect(result.user).toContain('MANDATORY')
  })
})
