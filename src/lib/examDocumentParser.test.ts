import { describe, it, expect } from 'vitest'
import { parseExamDocument, getAnsweredQuestions } from './examDocumentParser'

describe('parseExamDocument', () => {
  it('returns empty for blank input', () => {
    expect(parseExamDocument('')).toEqual({ segments: [], questionCount: 0 })
    expect(parseExamDocument('   ')).toEqual({ segments: [], questionCount: 0 })
  })

  it('parses a simple document with numbered questions', () => {
    const doc = `# Espaces vectoriels

Dans tout le sujet, on considère des espaces vectoriels de dimension finie.

## I  Généralités

1. Montrer que $\\text{tr}(u^k) = 0$ pour tout $k \\in \\mathbb{N}^*$.

2. Justifier que $\\mathcal{N}_\\mathbf{B}$ est un sous-espace vectoriel nilpotent.

## II  Endomorphismes de rang 1

On considère ici un espace vectoriel euclidien.

3. Montrer que l'application $a \\mapsto a \\otimes x$ est linéaire.

4. En déduire que $\\text{tr}(a \\otimes x) = (a | x)$.`

    const result = parseExamDocument(doc)

    expect(result.questionCount).toBe(4)
    expect(result.segments.length).toBe(6) // prose, q1, q2, prose (Part II), q3, q4

    // First segment should be the intro + Part I header
    expect(result.segments[0].type).toBe('prose')
    expect(result.segments[0].content).toContain('Espaces vectoriels')
    expect(result.segments[0].content).toContain('Généralités')

    // Questions
    expect(result.segments[1].type).toBe('question')
    expect(result.segments[1].questionNumber).toBe(1)
    expect(result.segments[1].content).toContain('Montrer que')

    expect(result.segments[2].type).toBe('question')
    expect(result.segments[2].questionNumber).toBe(2)

    // Part II header should start a new prose segment
    expect(result.segments[3].type).toBe('prose')
    expect(result.segments[3].content).toContain('Endomorphismes de rang 1')

    expect(result.segments[4].type).toBe('question')
    expect(result.segments[4].questionNumber).toBe(3)

    expect(result.segments[5].type).toBe('question')
    expect(result.segments[5].questionNumber).toBe(4)
  })

  it('handles bold question markers', () => {
    const doc = `Introduction text.

**1.** Montrer que $f$ est continue.

**2.** En déduire que $f$ est bornée.`

    const result = parseExamDocument(doc)
    expect(result.questionCount).toBe(2)
    expect(result.segments[1].type).toBe('question')
    expect(result.segments[1].questionNumber).toBe(1)
    expect(result.segments[2].type).toBe('question')
    expect(result.segments[2].questionNumber).toBe(2)
  })

  it('handles "Question N." style markers', () => {
    const doc = `Preambule.

**Question 1.** Montrer que...

**Question 2.** En déduire...`

    const result = parseExamDocument(doc)
    expect(result.questionCount).toBe(2)
    expect(result.segments[1].questionNumber).toBe(1)
    expect(result.segments[2].questionNumber).toBe(2)
  })

  it('keeps multi-line question content together', () => {
    const doc = `Intro.

1. Montrer que la famille
$(x, u(x), \\ldots, u^{p-1}(x))$ est libre, et que si
$(u^{p-1}(x), u^{q-1}(y))$ est libre alors la famille complète est libre.

2. Conclure.`

    const result = parseExamDocument(doc)
    expect(result.questionCount).toBe(2)
    expect(result.segments[1].content).toContain('famille complète est libre')
    expect(result.segments[2].questionNumber).toBe(2)
  })

  it('handles prose blocks between questions within same part', () => {
    const doc = `## III  Deux lemmes

On introduit le sous-ensemble $\\mathcal{V}^\\bullet$ de $E$.

On note $K(\\mathcal{V}) := \\text{Vect}(\\mathcal{V}^\\bullet)$.

8. Montrer qu'il existe une unique famille.

On note $p := \\max_{u \\in \\mathcal{V}} \\nu(u)$.

9. Montrer que $\\sum_{i=0}^{p-1} u^i v u^{p-1-i} = 0$.`

    const result = parseExamDocument(doc)
    // Part header + definition → prose, Q8, more notation (stays in Q8 since no header break), Q9
    expect(result.questionCount).toBe(9) // max question number
    expect(result.segments.filter(s => s.type === 'question')).toHaveLength(2)
  })
})

describe('getAnsweredQuestions', () => {
  it('returns set of question numbers with non-empty answers', () => {
    const answers = { 1: 'some answer', 2: '', 3: '  ', 4: 'another' }
    const result = getAnsweredQuestions(answers)
    expect(result).toEqual(new Set([1, 4]))
  })

  it('handles empty object', () => {
    expect(getAnsweredQuestions({})).toEqual(new Set())
  })
})
