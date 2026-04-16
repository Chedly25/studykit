import { describe, it, expect } from 'vitest'
import { buildCommentaireGradingPrompt } from '../commentairePrompts'
import type { CommentaireTask, CommentaireSubmission } from '../../coaching/types'

function makeTask(): CommentaireTask {
  return {
    decision: {
      id: 'vect-456',
      chamber: 'Chambre civile 1',
      reference: 'Cass. civ. 1, 15 oct. 2025, n° 24-18.532',
      breadcrumb: '15 octobre 2025',
      text: 'LA COUR, Vu l\'article 1231-1 du Code civil ; Attendu...',
    },
    generatedAt: '2026-04-16T00:00:00.000Z',
  }
}

function makeSubmission(overrides: Partial<CommentaireSubmission> = {}): CommentaireSubmission {
  return {
    introduction: 'La force obligatoire du contrat...',
    I: { title: 'L\'affirmation', IA: 'La règle', IB: 'Le fondement' },
    II: { title: 'La délimitation', IIA: 'Condition moratoires', IIB: 'La portée' },
    submittedAt: '2026-04-16T00:05:00.000Z',
    ...overrides,
  }
}

describe('buildCommentaireGradingPrompt', () => {
  it('returns non-empty system and user strings', () => {
    const result = buildCommentaireGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(result.system.length).toBeGreaterThan(100)
    expect(result.user.length).toBeGreaterThan(100)
  })

  it('includes CRFPA + commentaire context + pedagogical rule', () => {
    const { system } = buildCommentaireGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(system).toContain('CRFPA')
    expect(system).toContain('commentaire d\'arrêt')
    expect(system).toContain('PÉDAGOGIQUE')
    expect(system).toMatch(/n'écris JAMAIS à la place/)
  })

  it('notes that commentaire plan differs from dissertation plan', () => {
    const { system } = buildCommentaireGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(system).toContain('DIFFÈRE d\'un plan de dissertation')
  })

  it('forbids emojis and requires strict JSON', () => {
    const { system } = buildCommentaireGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(system).toContain('Aucun emoji')
    expect(system).toContain('JSON')
  })

  it('echoes the decision + all 7 student fields', () => {
    const { user } = buildCommentaireGradingPrompt({
      task: makeTask(),
      submission: makeSubmission({
        introduction: 'INTRO_CUSTOM',
        I: { title: 'TITLE_I', IA: 'IA_SUB', IB: 'IB_SUB' },
        II: { title: 'TITLE_II', IIA: 'IIA_SUB', IIB: 'IIB_SUB' },
      }),
    })
    expect(user).toContain('Chambre civile 1')
    expect(user).toContain('LA COUR')
    expect(user).toContain('INTRO_CUSTOM')
    expect(user).toContain('TITLE_I')
    expect(user).toContain('IA_SUB')
    expect(user).toContain('IB_SUB')
    expect(user).toContain('TITLE_II')
    expect(user).toContain('IIA_SUB')
    expect(user).toContain('IIB_SUB')
  })

  it('marks empty fields as "(vide)"', () => {
    const { user } = buildCommentaireGradingPrompt({
      task: makeTask(),
      submission: makeSubmission({
        introduction: '',
        I: { title: '', IA: '', IB: '' },
        II: { title: '', IIA: '', IIB: '' },
      }),
    })
    expect(user).toContain('(vide)')
  })

  it('includes all 5 axis keys in JSON schema', () => {
    const { user } = buildCommentaireGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(user).toContain('accroche')
    expect(user).toContain('interet')
    expect(user).toContain('problematique')
    expect(user).toContain('plan')
    expect(user).toContain('articulation')
  })
})
