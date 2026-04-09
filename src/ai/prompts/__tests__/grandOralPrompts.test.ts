import { describe, it, expect } from 'vitest'
import { buildGrandOralGenerationPrompt } from '../grandOralPrompts'

describe('buildGrandOralGenerationPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildGrandOralGenerationPrompt({})
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(100)
  })

  it('includes CRFPA Grand Oral context', () => {
    const result = buildGrandOralGenerationPrompt({})
    expect(result.system).toContain('Grand Oral')
    expect(result.system).toContain('CRFPA')
    expect(result.system).toContain('libertés et droits fondamentaux')
  })

  it('mentions the three types of subjects', () => {
    const result = buildGrandOralGenerationPrompt({})
    expect(result.system).toContain('Question ouverte')
    expect(result.system).toContain('Commentaire de décision')
    expect(result.system).toContain('Commentaire d\'article')
  })

  it('includes topic hints when provided', () => {
    const result = buildGrandOralGenerationPrompt({ topics: ['Vie privée', 'Liberté d\'expression'] })
    expect(result.user).toContain('Vie privée')
    expect(result.user).toContain('Liberté d\'expression')
  })

  it('includes avoidTopics when provided', () => {
    const result = buildGrandOralGenerationPrompt({ avoidTopics: ['Droit au silence', 'GPA'] })
    expect(result.user).toContain('Droit au silence')
    expect(result.user).toContain('GPA')
  })

  it('works with empty config', () => {
    const result = buildGrandOralGenerationPrompt({})
    expect(result.system).toBeTruthy()
    expect(result.user).toBeTruthy()
  })

  it('includes expected JSON structure in user prompt', () => {
    const result = buildGrandOralGenerationPrompt({})
    expect(result.user).toContain('topic')
    expect(result.user).toContain('expectedPlan')
    expect(result.user).toContain('keyPoints')
    expect(result.user).toContain('subsidiaryQuestions')
  })

  it('mentions 15 minutes and 30 minutes', () => {
    const result = buildGrandOralGenerationPrompt({})
    expect(result.system).toContain('15 minutes')
    expect(result.system).toContain('30 minutes')
  })
})
