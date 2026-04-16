import { describe, it, expect } from 'vitest'
import { buildFicheArretGradingPrompt, FICHE_CHAMBERS } from '../ficheArretPrompts'
import type { FicheTask, FicheSubmission } from '../../coaching/types'

function makeTask(): FicheTask {
  return {
    decision: {
      id: 'vect-123',
      chamber: 'Chambre sociale',
      reference: 'Cass. soc. 15 oct. 2025, n° 24-18.532',
      breadcrumb: '15 octobre 2025',
      text: 'LA COUR, Vu l\'article L1232-1 du Code du travail ; Attendu...',
    },
    generatedAt: '2026-04-16T00:00:00.000Z',
  }
}

function makeSubmission(overrides: Partial<FicheSubmission> = {}): FicheSubmission {
  return {
    faits: 'Le salarié a été licencié',
    procedure: 'Appel puis cassation',
    moyens: 'Le demandeur soutient que',
    questionDeDroit: 'La cause est-elle réelle ?',
    solutionEtPortee: 'Cassation au visa de L1232-1',
    submittedAt: '2026-04-16T00:05:00.000Z',
    ...overrides,
  }
}

describe('buildFicheArretGradingPrompt', () => {
  it('returns non-empty system and user strings', () => {
    const result = buildFicheArretGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(100)
    expect(result.user.length).toBeGreaterThan(100)
  })

  it('includes CRFPA + fiche context + pedagogical rule', () => {
    const { system } = buildFicheArretGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(system).toContain('CRFPA')
    expect(system).toContain('fiche d\'arrêt')
    expect(system).toContain('PÉDAGOGIQUE')
    expect(system).toMatch(/n'écris JAMAIS à la place/)
  })

  it('forbids emojis and requires strict JSON', () => {
    const { system } = buildFicheArretGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(system).toContain('Aucun emoji')
    expect(system).toContain('JSON')
  })

  it('echoes the decision reference and text', () => {
    const { user } = buildFicheArretGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(user).toContain('Chambre sociale')
    expect(user).toContain('Cass. soc. 15 oct. 2025')
    expect(user).toContain('LA COUR')
  })

  it('echoes all 5 student sections', () => {
    const { user } = buildFicheArretGradingPrompt({
      task: makeTask(),
      submission: makeSubmission({
        faits: 'FAITS_CUSTOM',
        procedure: 'PROC_CUSTOM',
        moyens: 'MOYENS_CUSTOM',
        questionDeDroit: 'QDROIT_CUSTOM',
        solutionEtPortee: 'SOLUTION_CUSTOM',
      }),
    })
    expect(user).toContain('FAITS_CUSTOM')
    expect(user).toContain('PROC_CUSTOM')
    expect(user).toContain('MOYENS_CUSTOM')
    expect(user).toContain('QDROIT_CUSTOM')
    expect(user).toContain('SOLUTION_CUSTOM')
  })

  it('marks empty fields as "(vide)"', () => {
    const { user } = buildFicheArretGradingPrompt({
      task: makeTask(),
      submission: makeSubmission({
        faits: '',
        procedure: '',
        moyens: '',
        questionDeDroit: '',
        solutionEtPortee: '',
      }),
    })
    expect(user).toContain('(vide)')
  })

  it('includes all 5 axis keys in JSON schema', () => {
    const { user } = buildFicheArretGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(user).toContain('faits')
    expect(user).toContain('procedure')
    expect(user).toContain('moyens')
    expect(user).toContain('questionDeDroit')
    expect(user).toContain('solutionEtPortee')
  })

  it('includes topMistake + strength in overall schema', () => {
    const { user } = buildFicheArretGradingPrompt({ task: makeTask(), submission: makeSubmission() })
    expect(user).toContain('topMistake')
    expect(user).toContain('strength')
  })
})

describe('FICHE_CHAMBERS', () => {
  it('has at least 5 chambers', () => {
    expect(FICHE_CHAMBERS.length).toBeGreaterThanOrEqual(5)
  })

  it('each chamber has id, label, codeName', () => {
    for (const c of FICHE_CHAMBERS) {
      expect(c.id).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(c.codeName).toContain('Jurisprudence')
    }
  })

  it('has unique ids', () => {
    const ids = FICHE_CHAMBERS.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
