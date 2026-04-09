import { describe, it, expect } from 'vitest'
import {
  buildThemeArchitectPrompt,
  buildDocumentGeneratorPrompt,
  buildCoherenceReviewerPrompt,
  buildModelSynthesisPrompt,
  buildGradingRubricPrompt,
} from '../synthesePrompts'
import type { DossierBlueprint, DossierDocumentSpec, DossierDocument } from '../synthesePrompts'

function makeBlueprint(overrides: Partial<DossierBlueprint> = {}): DossierBlueprint {
  return {
    theme: 'La protection des lanceurs d\'alerte',
    problematique: 'Comment le droit protège-t-il les lanceurs d\'alerte ?',
    planSuggere: {
      I: 'Un cadre juridique en construction',
      IA: 'Les textes fondateurs',
      IB: 'Les évolutions récentes',
      II: 'Des limites persistantes',
      IIA: 'Les lacunes du dispositif',
      IIB: 'Les pistes d\'amélioration',
    },
    documents: [makeDocSpec()],
    crossReferences: ['Doc 2 cite la loi du Doc 1'],
    ...overrides,
  }
}

function makeDocSpec(overrides: Partial<DossierDocumentSpec> = {}): DossierDocumentSpec {
  return {
    docNumber: 1,
    type: 'legislation',
    title: 'Loi n° 2022-401 du 21 mars 2022',
    role: 'Texte de base sur la protection',
    feedsPlanSection: 'IA',
    approximateLength: '1 page',
    ...overrides,
  }
}

function makeDoc(overrides: Partial<DossierDocument> = {}): DossierDocument {
  return {
    docNumber: 1,
    title: 'Loi n° 2022-401',
    type: 'legislation',
    content: 'Article 1er. Tout lanceur d\'alerte bénéficie de la protection...',
    ...overrides,
  }
}

describe('buildThemeArchitectPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildThemeArchitectPrompt({})
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(100)
  })

  it('includes CRFPA context', () => {
    const result = buildThemeArchitectPrompt({})
    expect(result.system).toContain('CRFPA')
    expect(result.system).toContain('note de synthèse')
  })

  it('includes topic hints', () => {
    const result = buildThemeArchitectPrompt({ topics: ['Droit du travail', 'Discrimination'] })
    expect(result.user).toContain('Droit du travail')
    expect(result.user).toContain('Discrimination')
  })

  it('includes avoidThemes', () => {
    const result = buildThemeArchitectPrompt({ avoidThemes: ['GPA', 'Euthanasie'] })
    expect(result.user).toContain('GPA')
    expect(result.user).toContain('Euthanasie')
  })

  it('works with empty config', () => {
    const result = buildThemeArchitectPrompt({})
    expect(result.system).toBeTruthy()
    expect(result.user).toBeTruthy()
  })
})

describe('buildDocumentGeneratorPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildDocumentGeneratorPrompt(makeBlueprint(), makeDocSpec())
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('includes blueprint theme and problematique', () => {
    const result = buildDocumentGeneratorPrompt(makeBlueprint(), makeDocSpec())
    expect(result.user).toContain('protection des lanceurs')
    expect(result.user).toContain('Comment le droit protège')
  })

  it('includes document spec details', () => {
    const result = buildDocumentGeneratorPrompt(makeBlueprint(), makeDocSpec())
    expect(result.user).toContain('Document n° 1')
    expect(result.user).toContain('legislation')
    expect(result.user).toContain('IA')
  })

  it('includes cross references', () => {
    const result = buildDocumentGeneratorPrompt(
      makeBlueprint(),
      makeDocSpec({ crossReferences: ['Citer l\'article 3 du Doc 2'] }),
    )
    expect(result.user).toContain('Citer l\'article 3 du Doc 2')
  })

  const docTypes = ['legislation', 'jurisprudence-cass', 'jurisprudence-ce', 'jurisprudence-cedh', 'doctrine', 'presse', 'rapport', 'circulaire'] as const
  for (const type of docTypes) {
    it(`uses format template for ${type}`, () => {
      const result = buildDocumentGeneratorPrompt(makeBlueprint(), makeDocSpec({ type }))
      expect(result.user).toContain('FORMAT ATTENDU')
    })
  }
})

describe('buildCoherenceReviewerPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildCoherenceReviewerPrompt(makeBlueprint(), [makeDoc()])
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('includes the document content', () => {
    const result = buildCoherenceReviewerPrompt(makeBlueprint(), [makeDoc()])
    expect(result.user).toContain('DOCUMENT 1')
    expect(result.user).toContain('lanceur d\'alerte')
  })

  it('includes blueprint JSON', () => {
    const result = buildCoherenceReviewerPrompt(makeBlueprint(), [makeDoc()])
    expect(result.user).toContain('BLUEPRINT')
    expect(result.user).toContain('protection des lanceurs')
  })
})

describe('buildModelSynthesisPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildModelSynthesisPrompt(makeBlueprint(), [makeDoc()])
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('includes methodology instructions', () => {
    const result = buildModelSynthesisPrompt(makeBlueprint(), [makeDoc()])
    expect(result.system).toContain('Introduction')
    expect(result.system).toContain('2400 mots')
    expect(result.system).toContain('Tous les documents')
  })

  it('includes plan and document content', () => {
    const result = buildModelSynthesisPrompt(makeBlueprint(), [makeDoc()])
    expect(result.user).toContain('Un cadre juridique en construction')
    expect(result.user).toContain('Document 1')
  })
})

describe('buildGradingRubricPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildGradingRubricPrompt(makeBlueprint(), [makeDoc()], 'Model synthesis text...')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('includes theme and plan', () => {
    const result = buildGradingRubricPrompt(makeBlueprint(), [makeDoc()], 'Model synthesis text...')
    expect(result.user).toContain('protection des lanceurs')
    expect(result.user).toContain('PLAN ATTENDU')
  })

  it('includes model synthesis excerpt', () => {
    const result = buildGradingRubricPrompt(makeBlueprint(), [makeDoc()], 'Model synthesis text...')
    expect(result.user).toContain('Model synthesis text...')
  })

  it('mentions 20 points total', () => {
    const result = buildGradingRubricPrompt(makeBlueprint(), [makeDoc()], 'text')
    expect(result.user).toContain('20 points')
  })
})
