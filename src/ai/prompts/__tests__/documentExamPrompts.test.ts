import { describe, it, expect } from 'vitest'
import {
  buildDocumentExamPrompt,
  buildSolutionPrompt,
  CONCOURS_OPTIONS,
  SUBJECT_OPTIONS,
} from '../documentExamPrompts'
import type { DocumentExamPromptConfig, ConcoursType, DocumentExamSubject } from '../documentExamPrompts'

function makeConfig(overrides: Partial<DocumentExamPromptConfig> = {}): DocumentExamPromptConfig {
  return {
    subject: 'maths-algebre',
    concours: 'polytechnique',
    topics: ['Algèbre linéaire', 'Groupes'],
    ...overrides,
  }
}

describe('buildDocumentExamPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildDocumentExamPrompt(makeConfig())
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(100)
    expect(result.user.length).toBeGreaterThan(50)
  })

  describe('maths-algebre subject', () => {
    it('includes algebra domain guidance', () => {
      const result = buildDocumentExamPrompt(makeConfig({ subject: 'maths-algebre' }))
      expect(result.user).toContain('Algèbre')
      expect(result.system).toContain('Polytechnique (X)')
    })

    it('includes topic hints', () => {
      const result = buildDocumentExamPrompt(makeConfig({ topics: ['Espaces vectoriels'] }))
      expect(result.user).toContain('Espaces vectoriels')
    })

    it('includes avoidThemes', () => {
      const result = buildDocumentExamPrompt(makeConfig({ avoidThemes: ['Gerstenhaber'] }))
      expect(result.user).toContain('Gerstenhaber')
    })

    it('includes source excerpts', () => {
      const result = buildDocumentExamPrompt(makeConfig({ sourceExcerpts: 'Some course content...' }))
      expect(result.user).toContain('Some course content...')
    })

    it('includes DNA profile block when provided', () => {
      const result = buildDocumentExamPrompt(makeConfig({ dnaProfileBlock: '## CUSTOM DNA BLOCK' }))
      expect(result.system).toContain('CUSTOM DNA BLOCK')
    })
  })

  describe('maths-analyse subject', () => {
    it('includes analysis domain guidance', () => {
      const result = buildDocumentExamPrompt(makeConfig({ subject: 'maths-analyse' }))
      expect(result.user).toContain('Analyse')
    })
  })

  describe('physique subject', () => {
    it('returns physics-specific prompt', () => {
      const result = buildDocumentExamPrompt(makeConfig({ subject: 'physique' }))
      expect(result.system).toContain('physique')
      expect(result.system).toContain('SYSTÈME PHYSIQUE')
    })

    it('includes physics topics', () => {
      const result = buildDocumentExamPrompt(makeConfig({ subject: 'physique', topics: ['Mécanique', 'Thermodynamique'] }))
      expect(result.user).toContain('Mécanique')
    })

    it('includes avoidThemes for physics', () => {
      const result = buildDocumentExamPrompt(makeConfig({ subject: 'physique', avoidThemes: ['Pendule simple'] }))
      expect(result.user).toContain('Pendule simple')
    })

    it('includes source excerpts for physics', () => {
      const result = buildDocumentExamPrompt(makeConfig({ subject: 'physique', sourceExcerpts: 'Physics notes...' }))
      expect(result.user).toContain('Physics notes...')
    })
  })

  describe('informatique subject', () => {
    it('returns CS-specific prompt', () => {
      const result = buildDocumentExamPrompt(makeConfig({ subject: 'informatique' }))
      expect(result.system).toContain('informatique')
      expect(result.system).toContain('OCaml')
    })

    it('includes CS topics', () => {
      const result = buildDocumentExamPrompt(makeConfig({ subject: 'informatique', topics: ['Graphes', 'Arbres'] }))
      expect(result.user).toContain('Graphes')
    })

    it('includes avoidThemes for CS', () => {
      const result = buildDocumentExamPrompt(makeConfig({ subject: 'informatique', avoidThemes: ['BST'] }))
      expect(result.user).toContain('BST')
    })
  })

  describe('all concours types', () => {
    const concoursTypes: ConcoursType[] = ['polytechnique', 'mines', 'centrale', 'ccinp']

    for (const concours of concoursTypes) {
      it(`generates valid prompt for ${concours}`, () => {
        const result = buildDocumentExamPrompt(makeConfig({ concours }))
        expect(result.system.length).toBeGreaterThan(100)
        expect(result.user.length).toBeGreaterThan(50)
      })
    }
  })

  it('falls back to maths prompt for unknown subject', () => {
    const result = buildDocumentExamPrompt(makeConfig({ subject: 'unknown' as DocumentExamSubject }))
    expect(result.system).toContain('mathématiques')
  })

  it('handles empty topics array', () => {
    const result = buildDocumentExamPrompt(makeConfig({ topics: [] }))
    expect(result.user).not.toContain('sujets étudiés')
  })
})

describe('buildSolutionPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildSolutionPrompt('Some exam content here.')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('includes the document content in user prompt', () => {
    const result = buildSolutionPrompt('Partie I. Question 1. Montrer que...')
    expect(result.user).toContain('Partie I. Question 1. Montrer que...')
  })

  it('system prompt mentions JSON and marking scheme', () => {
    const result = buildSolutionPrompt('Test')
    expect(result.system).toContain('JSON')
    expect(result.system).toContain('markingScheme')
    expect(result.system).toContain('barème')
  })
})

describe('CONCOURS_OPTIONS', () => {
  it('has 4 options', () => {
    expect(CONCOURS_OPTIONS).toHaveLength(4)
  })

  it('each has value and label', () => {
    for (const opt of CONCOURS_OPTIONS) {
      expect(opt.value).toBeTruthy()
      expect(opt.label).toBeTruthy()
    }
  })
})

describe('SUBJECT_OPTIONS', () => {
  it('has 4 options', () => {
    expect(SUBJECT_OPTIONS).toHaveLength(4)
  })

  it('each has value, label, and labelFr', () => {
    for (const opt of SUBJECT_OPTIONS) {
      expect(opt.value).toBeTruthy()
      expect(opt.label).toBeTruthy()
      expect(opt.labelFr).toBeTruthy()
    }
  })
})
