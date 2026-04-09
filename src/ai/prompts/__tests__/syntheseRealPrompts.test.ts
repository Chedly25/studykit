import { describe, it, expect } from 'vitest'
import {
  buildRealThemeArchitectPrompt,
  buildDocumentCuratorPrompt,
  buildRealModelSynthesisPrompt,
  buildRealGradingRubricPrompt,
  buildQualityPatchPrompt,
} from '../syntheseRealPrompts'
import type { RealDossierBlueprint, RealDossierDocument, DocumentSlot } from '../syntheseRealPrompts'

function makeBlueprint(overrides: Partial<RealDossierBlueprint> = {}): RealDossierBlueprint {
  return {
    theme: 'La protection des lanceurs d\'alerte',
    problematique: 'Comment le droit français protège-t-il les lanceurs d\'alerte ?',
    planSuggere: {
      I: 'Le cadre juridique',
      IA: 'Textes législatifs',
      IB: 'Jurisprudence',
      II: 'Les limites',
      IIA: 'Lacunes',
      IIB: 'Perspectives',
    },
    documentSlots: [makeSlot()],
    ...overrides,
  }
}

function makeSlot(overrides: Partial<DocumentSlot> = {}): DocumentSlot {
  return {
    slotNumber: 1,
    type: 'jurisprudence-cass',
    description: 'Arrêt sur la nullité du licenciement',
    feedsPlanSection: 'IA',
    searchQueries: ['lanceur alerte licenciement nullité'],
    ...overrides,
  }
}

function makeRealDoc(overrides: Partial<RealDossierDocument> = {}): RealDossierDocument {
  return {
    docNumber: 1,
    type: 'jurisprudence-cass',
    title: 'Cass. soc., 10 mars 2023, n° 21-12.345',
    sourceUrl: 'https://judilibre.fr/decision/12345',
    content: 'La Cour de cassation retient que le licenciement du lanceur d\'alerte est nul...',
    ...overrides,
  }
}

describe('buildRealThemeArchitectPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildRealThemeArchitectPrompt({})
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(100)
  })

  it('mentions CRFPA and real sources', () => {
    const result = buildRealThemeArchitectPrompt({})
    expect(result.system).toContain('CRFPA')
    expect(result.system).toContain('SOURCES RÉELLES')
  })

  it('includes topic hints', () => {
    const result = buildRealThemeArchitectPrompt({ topics: ['Droit pénal'] })
    expect(result.user).toContain('Droit pénal')
  })

  it('includes avoidThemes', () => {
    const result = buildRealThemeArchitectPrompt({ avoidThemes: ['GPA'] })
    expect(result.user).toContain('GPA')
  })

  it('works with empty config', () => {
    const result = buildRealThemeArchitectPrompt({})
    expect(result.system).toBeTruthy()
    expect(result.user).toBeTruthy()
  })
})

describe('buildDocumentCuratorPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildDocumentCuratorPrompt(
      'Theme', 'Problematique', makeSlot(), 'Raw content...', 'Title', 'https://example.com',
    )
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('includes theme and problematique', () => {
    const result = buildDocumentCuratorPrompt(
      'Protection des lanceurs', 'Comment protéger ?', makeSlot(), 'content', 'Title', 'https://url.com',
    )
    expect(result.user).toContain('Protection des lanceurs')
    expect(result.user).toContain('Comment protéger ?')
  })

  it('includes source title and URL', () => {
    const result = buildDocumentCuratorPrompt(
      'Theme', 'Problem', makeSlot(), 'content', 'Important Decision', 'https://judilibre.fr/test',
    )
    expect(result.user).toContain('Important Decision')
    expect(result.user).toContain('https://judilibre.fr/test')
  })

  it('includes slot description and type', () => {
    const result = buildDocumentCuratorPrompt(
      'Theme', 'Problem', makeSlot({ description: 'Key arrest', type: 'jurisprudence-cass' }),
      'content', 'Title', 'url',
    )
    expect(result.user).toContain('Key arrest')
    expect(result.user).toContain('jurisprudence-cass')
  })

  it('truncates raw content to 20000 chars', () => {
    const longContent = 'x'.repeat(25000)
    const result = buildDocumentCuratorPrompt('T', 'P', makeSlot(), longContent, 'T', 'U')
    expect(result.user.length).toBeLessThan(longContent.length + 2000)
  })

  it('system prompt mentions fidelity rules', () => {
    const result = buildDocumentCuratorPrompt('T', 'P', makeSlot(), 'content', 'T', 'U')
    expect(result.system).toContain('FIDÈLE')
    expect(result.system).toContain('600 à 1200 mots')
  })
})

describe('buildRealModelSynthesisPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildRealModelSynthesisPrompt(makeBlueprint(), [makeRealDoc()])
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('includes methodology for real documents', () => {
    const result = buildRealModelSynthesisPrompt(makeBlueprint(), [makeRealDoc()])
    expect(result.system).toContain('RESTITUTION NEUTRE')
    expect(result.system).toContain('2400 mots')
  })

  it('includes plan and document content', () => {
    const result = buildRealModelSynthesisPrompt(makeBlueprint(), [makeRealDoc()])
    expect(result.user).toContain('Le cadre juridique')
    expect(result.user).toContain('Document 1')
    expect(result.user).toContain('judilibre.fr')
  })

  it('includes forbidden phrases', () => {
    const result = buildRealModelSynthesisPrompt(makeBlueprint(), [makeRealDoc()])
    expect(result.system).toContain('PHRASES INTERDITES')
    expect(result.system).toContain('il apparaît nécessaire')
  })
})

describe('buildRealGradingRubricPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildRealGradingRubricPrompt(makeBlueprint(), [makeRealDoc()], 'Model text...')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('includes theme and plan', () => {
    const result = buildRealGradingRubricPrompt(makeBlueprint(), [makeRealDoc()], 'Model text...')
    expect(result.user).toContain('protection des lanceurs')
    expect(result.user).toContain('PLAN ATTENDU')
  })

  it('includes document source URLs', () => {
    const result = buildRealGradingRubricPrompt(makeBlueprint(), [makeRealDoc()], 'text')
    expect(result.user).toContain('judilibre.fr')
  })

  it('mentions 20 points total', () => {
    const result = buildRealGradingRubricPrompt(makeBlueprint(), [makeRealDoc()], 'text')
    expect(result.user).toContain('20 points')
  })
})

describe('buildQualityPatchPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildQualityPatchPrompt('Current synthesis...', [], 2500, false)
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('includes current synthesis', () => {
    const result = buildQualityPatchPrompt('La synthèse actuelle...', [], 2500, false)
    expect(result.user).toContain('La synthèse actuelle...')
  })

  it('includes uncited documents when provided', () => {
    const uncited = [makeRealDoc({ docNumber: 5, title: 'Document manquant' })]
    const result = buildQualityPatchPrompt('Current text', uncited, 2000, false)
    expect(result.user).toContain('DOCUMENTS NON CITÉS')
    expect(result.user).toContain('Document manquant')
  })

  it('includes expansion instructions when needed', () => {
    const result = buildQualityPatchPrompt('Short text', [], 1800, true)
    expect(result.user).toContain('LONGUEUR INSUFFISANTE')
    expect(result.user).toContain('1800 mots')
    expect(result.user).toContain('2400 mots')
  })

  it('handles both uncited docs and expansion together', () => {
    const uncited = [makeRealDoc({ docNumber: 3 })]
    const result = buildQualityPatchPrompt('text', uncited, 1500, true)
    expect(result.user).toContain('DOCUMENTS NON CITÉS')
    expect(result.user).toContain('LONGUEUR INSUFFISANTE')
  })

  it('system prompt mentions preservation rules', () => {
    const result = buildQualityPatchPrompt('text', [], 2000, false)
    expect(result.system).toContain('Conserve le plan')
    expect(result.system).toContain('Ne supprime rien')
  })
})
