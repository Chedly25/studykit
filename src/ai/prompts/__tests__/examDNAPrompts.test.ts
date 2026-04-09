import { describe, it, expect } from 'vitest'
import { buildDNAAnalysisPrompt, buildDNAProfileBlock, mergeDNAProfiles } from '../examDNAPrompts'
import type { DNAProfile } from '../examDNAPrompts'

function makeDNAProfile(overrides: Partial<DNAProfile> = {}): DNAProfile {
  return {
    structure: {
      partCount: 4,
      questionsPerPart: [5, 6, 5, 4],
      totalQuestions: 20,
      hasPreambule: true,
      hasTheoremTarget: true,
      hasNavigationParagraph: true,
    },
    questionTypes: {
      montrerQue: 0.4,
      enDeduire: 0.2,
      calculer: 0.15,
      determiner: 0.1,
      justifier: 0.05,
      openEnded: 0.1,
    },
    difficulty: {
      curveShape: 'gradual-escalation',
      scaffoldingLevel: 'moderate',
      hintsCount: 3,
      questionsWithoutHints: 12,
      questionsWhereStudentFindsResult: 5,
    },
    content: {
      primaryDomain: 'Algèbre linéaire',
      secondaryDomains: ['Analyse', 'Probabilités'],
      crossDomainIntegration: 'moderate',
      theoremLevel: 'research',
      notationDensity: 'high',
      customNotations: ['$\\mathcal{V}^\\bullet$', '$K(\\mathcal{V})$'],
    },
    style: {
      proseDensity: 'dense',
      formalityLevel: 'very-formal',
      subpartUsage: 'frequent',
      samplePatterns: ['Montrer que $\\text{tr}(u^k) = 0$ pour tout $k \\geq 1$.', 'En déduire que $u$ est nilpotent.'],
    },
    ...overrides,
  }
}

describe('buildDNAAnalysisPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildDNAAnalysisPrompt('Partie I. Question 1...')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('includes exam text in user prompt', () => {
    const examText = 'Partie I. Algèbre linéaire. Question 1. Montrer que...'
    const result = buildDNAAnalysisPrompt(examText)
    expect(result.user).toContain(examText)
  })

  it('system mentions JSON output', () => {
    const result = buildDNAAnalysisPrompt('test')
    expect(result.system).toContain('JSON')
  })

  it('user prompt contains expected JSON fields', () => {
    const result = buildDNAAnalysisPrompt('test')
    expect(result.user).toContain('structure')
    expect(result.user).toContain('questionTypes')
    expect(result.user).toContain('difficulty')
    expect(result.user).toContain('content')
    expect(result.user).toContain('style')
  })
})

describe('buildDNAProfileBlock', () => {
  it('returns a non-empty string', () => {
    const result = buildDNAProfileBlock(makeDNAProfile(), 3)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(100)
  })

  it('includes paper count', () => {
    const result = buildDNAProfileBlock(makeDNAProfile(), 5)
    expect(result).toContain('5 sujets réels')
  })

  it('includes structure info', () => {
    const result = buildDNAProfileBlock(makeDNAProfile(), 1)
    expect(result).toContain('4 parties')
    expect(result).toContain('20 questions')
    expect(result).toContain('Préambule avec notations')
    expect(result).toContain('Théorème cible')
    expect(result).toContain('Paragraphe de navigation')
  })

  it('includes question type distribution', () => {
    const result = buildDNAProfileBlock(makeDNAProfile(), 1)
    expect(result).toContain('Montrer que')
    expect(result).toContain('En déduire')
    expect(result).toContain('40%')
  })

  it('filters out question types below 3%', () => {
    const dna = makeDNAProfile({ questionTypes: { montrerQue: 0.5, tiny: 0.02 } })
    const result = buildDNAProfileBlock(dna, 1)
    expect(result).not.toContain('tiny')
  })

  it('includes difficulty info', () => {
    const result = buildDNAProfileBlock(makeDNAProfile(), 1)
    expect(result).toContain('gradual-escalation')
    expect(result).toContain('moderate')
    expect(result).toContain('3 indications')
  })

  it('includes content domains', () => {
    const result = buildDNAProfileBlock(makeDNAProfile(), 1)
    expect(result).toContain('Algèbre linéaire')
    expect(result).toContain('Analyse')
  })

  it('includes custom notations', () => {
    const result = buildDNAProfileBlock(makeDNAProfile(), 1)
    expect(result).toContain('$\\mathcal{V}^\\bullet$')
  })

  it('includes sample patterns', () => {
    const result = buildDNAProfileBlock(makeDNAProfile(), 1)
    expect(result).toContain('Montrer que $\\text{tr}(u^k)')
  })

  it('handles profile without sample patterns', () => {
    const dna = makeDNAProfile()
    dna.style.samplePatterns = []
    const result = buildDNAProfileBlock(dna, 1)
    expect(result).not.toContain('Patterns réels')
  })

  it('handles profile without custom notations', () => {
    const dna = makeDNAProfile()
    dna.content.customNotations = []
    const result = buildDNAProfileBlock(dna, 1)
    expect(result).not.toContain('Notations originales')
  })

  it('handles profile without preambule', () => {
    const dna = makeDNAProfile()
    dna.structure.hasPreambule = false
    const result = buildDNAProfileBlock(dna, 1)
    expect(result).toContain('Pas de préambule formel')
  })

  it('handles profile without theorem target', () => {
    const dna = makeDNAProfile()
    dna.structure.hasTheoremTarget = false
    const result = buildDNAProfileBlock(dna, 1)
    expect(result).toContain('Pas de théorème cible')
  })
})

describe('mergeDNAProfiles', () => {
  it('throws on empty array', () => {
    expect(() => mergeDNAProfiles([])).toThrow('No profiles to merge')
  })

  it('returns single profile unchanged', () => {
    const profile = makeDNAProfile()
    const result = mergeDNAProfiles([profile])
    expect(result).toBe(profile)
  })

  it('merges two profiles', () => {
    const p1 = makeDNAProfile({ structure: { partCount: 4, questionsPerPart: [5, 5, 5, 5], totalQuestions: 20, hasPreambule: true, hasTheoremTarget: true, hasNavigationParagraph: true } })
    const p2 = makeDNAProfile({ structure: { partCount: 6, questionsPerPart: [7, 7, 7, 7, 7, 7], totalQuestions: 42, hasPreambule: false, hasTheoremTarget: true, hasNavigationParagraph: false } })
    const result = mergeDNAProfiles([p1, p2])

    expect(result.structure.partCount).toBe(5) // avg of 4 and 6
    expect(result.structure.totalQuestions).toBe(31) // avg of 20 and 42
    expect(result.structure.hasTheoremTarget).toBe(true) // both true
  })

  it('averages question type distributions', () => {
    const p1 = makeDNAProfile({ questionTypes: { montrerQue: 0.6, calculer: 0.4 } })
    const p2 = makeDNAProfile({ questionTypes: { montrerQue: 0.4, calculer: 0.2, determiner: 0.4 } })
    const result = mergeDNAProfiles([p1, p2])

    expect(result.questionTypes.montrerQue).toBeCloseTo(0.5)
    expect(result.questionTypes.calculer).toBeCloseTo(0.3)
    expect(result.questionTypes.determiner).toBeCloseTo(0.2)
  })

  it('uses mode for categorical values', () => {
    const p1 = makeDNAProfile()
    p1.difficulty.scaffoldingLevel = 'low'
    p1.style.proseDensity = 'sparse'
    const p2 = makeDNAProfile()
    p2.difficulty.scaffoldingLevel = 'low'
    p2.style.proseDensity = 'dense'
    const p3 = makeDNAProfile()
    p3.difficulty.scaffoldingLevel = 'high'
    p3.style.proseDensity = 'dense'

    const result = mergeDNAProfiles([p1, p2, p3])
    expect(result.difficulty.scaffoldingLevel).toBe('low') // 2 out of 3
    expect(result.style.proseDensity).toBe('dense') // 2 out of 3
  })

  it('deduplicates sample patterns and custom notations', () => {
    const p1 = makeDNAProfile()
    p1.style.samplePatterns = ['Pattern A', 'Pattern B']
    p1.content.customNotations = ['$\\alpha$']
    const p2 = makeDNAProfile()
    p2.style.samplePatterns = ['Pattern B', 'Pattern C']
    p2.content.customNotations = ['$\\alpha$', '$\\beta$']

    const result = mergeDNAProfiles([p1, p2])
    expect(new Set(result.style.samplePatterns).size).toBe(result.style.samplePatterns.length)
    expect(new Set(result.content.customNotations).size).toBe(result.content.customNotations.length)
  })

  it('collects all secondary domains', () => {
    const p1 = makeDNAProfile()
    p1.content.secondaryDomains = ['Analyse']
    const p2 = makeDNAProfile()
    p2.content.secondaryDomains = ['Analyse', 'Topologie']

    const result = mergeDNAProfiles([p1, p2])
    expect(result.content.secondaryDomains).toContain('Analyse')
    expect(result.content.secondaryDomains).toContain('Topologie')
  })
})
