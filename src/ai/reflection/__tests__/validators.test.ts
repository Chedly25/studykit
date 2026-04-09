import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  flashcardValidator,
  conceptCardValidator,
  exerciseValidator,
  gradeValidator,
} from '../validators'
import type { FlashcardContent, ConceptCardContent, ExerciseContent, GradeContent } from '../validators'
import type { LlmFn } from '../../agents/types'

describe('validators', () => {
  let mockLlm: LlmFn

  beforeEach(() => {
    vi.clearAllMocks()
    mockLlm = vi.fn()
  })

  // ─── parseValidationJSON (tested indirectly via validate calls) ──

  describe('parseValidationJSON (via validate)', () => {
    it('parses valid JSON response', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": 0.9, "issues": [], "suggestions": ["good"] }')

      const result = await flashcardValidator.validate(
        { front: 'Q?', back: 'A' },
        mockLlm,
      )

      expect(result.score).toBe(0.9)
      expect(result.issues).toEqual([])
      expect(result.suggestions).toEqual(['good'])
    })

    it('extracts JSON from surrounding text', async () => {
      vi.mocked(mockLlm).mockResolvedValue('Here is the result: { "score": 0.7, "issues": ["vague"], "suggestions": [] } end')

      const result = await flashcardValidator.validate(
        { front: 'Q?', back: 'A' },
        mockLlm,
      )

      expect(result.score).toBe(0.7)
      expect(result.issues).toEqual(['vague'])
    })

    it('returns default on invalid JSON', async () => {
      vi.mocked(mockLlm).mockResolvedValue('not json at all')

      const result = await flashcardValidator.validate(
        { front: 'Q?', back: 'A' },
        mockLlm,
      )

      expect(result.score).toBe(0.5)
      expect(result.issues).toContain('Could not parse validation')
    })

    it('returns default on broken JSON', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ broken json }}}')

      const result = await flashcardValidator.validate(
        { front: 'Q?', back: 'A' },
        mockLlm,
      )

      expect(result.score).toBe(0.5)
      expect(result.issues).toContain('Validation parse error')
    })

    it('clamps score to 0-1 range', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": 5.0, "issues": [], "suggestions": [] }')

      const result = await flashcardValidator.validate(
        { front: 'Q?', back: 'A' },
        mockLlm,
      )

      expect(result.score).toBe(1)
    })

    it('clamps negative score to 0', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": -1.0, "issues": [], "suggestions": [] }')

      const result = await flashcardValidator.validate(
        { front: 'Q?', back: 'A' },
        mockLlm,
      )

      expect(result.score).toBe(0)
    })

    it('defaults missing issues/suggestions to empty arrays', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": 0.8 }')

      const result = await flashcardValidator.validate(
        { front: 'Q?', back: 'A' },
        mockLlm,
      )

      expect(result.issues).toEqual([])
      expect(result.suggestions).toEqual([])
    })
  })

  // ─── Flashcard Validator ─────────────────────────────────────────

  describe('flashcardValidator', () => {
    it('has correct metadata', () => {
      expect(flashcardValidator.name).toBe('flashcard')
      expect(flashcardValidator.minScore).toBe(0.7)
      expect(flashcardValidator.maxAttempts).toBe(2)
    })

    it('validate sends content to LLM', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": 0.8, "issues": [], "suggestions": [] }')
      const content: FlashcardContent = { front: 'What is X?', back: 'X is Y', topicName: 'Math' }

      await flashcardValidator.validate(content, mockLlm)

      expect(mockLlm).toHaveBeenCalledTimes(1)
      const prompt = vi.mocked(mockLlm).mock.calls[0][0]
      expect(prompt).toContain('What is X?')
      expect(prompt).toContain('X is Y')
      expect(prompt).toContain('Math')
    })

    it('validate works without topicName', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": 0.8, "issues": [], "suggestions": [] }')

      await flashcardValidator.validate({ front: 'Q?', back: 'A' }, mockLlm)

      const prompt = vi.mocked(mockLlm).mock.calls[0][0]
      expect(prompt).not.toContain('Topic:')
    })

    it('buildFixPrompt includes issues and suggestions', () => {
      const content: FlashcardContent = { front: 'Q?', back: 'A' }
      const prompt = flashcardValidator.buildFixPrompt(content, ['too vague'], ['be specific'])

      expect(prompt).toContain('too vague')
      expect(prompt).toContain('be specific')
      expect(prompt).toContain('Q?')
    })

    it('parseFixed extracts front and back from valid JSON', () => {
      const original: FlashcardContent = { front: 'old Q', back: 'old A' }
      const result = flashcardValidator.parseFixed(
        '{ "front": "new Q", "back": "new A" }',
        original,
      )

      expect(result.front).toBe('new Q')
      expect(result.back).toBe('new A')
    })

    it('parseFixed returns original on invalid JSON', () => {
      const original: FlashcardContent = { front: 'old Q', back: 'old A' }
      const result = flashcardValidator.parseFixed('not json', original)

      expect(result).toEqual(original)
    })

    it('parseFixed ignores non-string front/back', () => {
      const original: FlashcardContent = { front: 'old Q', back: 'old A' }
      const result = flashcardValidator.parseFixed(
        '{ "front": 123, "back": true }',
        original,
      )

      expect(result.front).toBe('old Q')
      expect(result.back).toBe('old A')
    })
  })

  // ─── Concept Card Validator ──────────────────────────────────────

  describe('conceptCardValidator', () => {
    it('has correct metadata', () => {
      expect(conceptCardValidator.name).toBe('concept-card')
      expect(conceptCardValidator.minScore).toBe(0.7)
      expect(conceptCardValidator.maxAttempts).toBe(2)
    })

    it('validate includes source content when provided', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": 0.8, "issues": [], "suggestions": [] }')
      const content: ConceptCardContent = {
        title: 'Concept',
        content: 'Description',
        keyPoints: ['point1'],
        sourceContent: 'Source text here',
      }

      await conceptCardValidator.validate(content, mockLlm)

      const prompt = vi.mocked(mockLlm).mock.calls[0][0]
      expect(prompt).toContain('Source excerpt')
      expect(prompt).toContain('Source text here')
    })

    it('validate omits source when not provided', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": 0.8, "issues": [], "suggestions": [] }')
      const content: ConceptCardContent = {
        title: 'Concept',
        content: 'Description',
        keyPoints: ['point1'],
      }

      await conceptCardValidator.validate(content, mockLlm)

      const prompt = vi.mocked(mockLlm).mock.calls[0][0]
      expect(prompt).not.toContain('Source excerpt')
    })

    it('buildFixPrompt includes content and issues', () => {
      const content: ConceptCardContent = {
        title: 'Concept',
        content: 'Description',
        keyPoints: ['a', 'b'],
      }
      const prompt = conceptCardValidator.buildFixPrompt(content, ['incomplete'], ['add examples'])

      expect(prompt).toContain('Concept')
      expect(prompt).toContain('incomplete')
      expect(prompt).toContain('add examples')
    })

    it('parseFixed extracts title, content, and keyPoints', () => {
      const original: ConceptCardContent = {
        title: 'Old',
        content: 'Old desc',
        keyPoints: ['old'],
      }
      const result = conceptCardValidator.parseFixed(
        '{ "title": "New", "content": "New desc", "keyPoints": ["new1", "new2"] }',
        original,
      )

      expect(result.title).toBe('New')
      expect(result.content).toBe('New desc')
      expect(result.keyPoints).toEqual(['new1', 'new2'])
    })

    it('parseFixed keeps original when types are wrong', () => {
      const original: ConceptCardContent = {
        title: 'Old',
        content: 'Old desc',
        keyPoints: ['old'],
      }
      const result = conceptCardValidator.parseFixed(
        '{ "title": 123, "keyPoints": "not-array" }',
        original,
      )

      expect(result.title).toBe('Old')
      expect(result.keyPoints).toEqual(['old'])
    })
  })

  // ─── Exercise Validator ──────────────────────────────────────────

  describe('exerciseValidator', () => {
    it('has correct metadata', () => {
      expect(exerciseValidator.name).toBe('exercise')
      expect(exerciseValidator.minScore).toBe(0.7)
      expect(exerciseValidator.maxAttempts).toBe(2)
    })

    it('validate sends exercise content to LLM', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": 0.9, "issues": [], "suggestions": [] }')
      const content: ExerciseContent = {
        text: 'Solve: 2+2',
        solutionText: '4',
        difficulty: 3,
        topicNames: ['Arithmetic'],
      }

      await exerciseValidator.validate(content, mockLlm)

      const prompt = vi.mocked(mockLlm).mock.calls[0][0]
      expect(prompt).toContain('Solve: 2+2')
      expect(prompt).toContain('4')
      expect(prompt).toContain('3/5')
      expect(prompt).toContain('Arithmetic')
    })

    it('validate handles missing solutionText', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": 0.6, "issues": ["no solution"], "suggestions": [] }')
      const content: ExerciseContent = {
        text: 'Solve this',
        difficulty: 2,
        topicNames: ['Math'],
      }

      await exerciseValidator.validate(content, mockLlm)

      const prompt = vi.mocked(mockLlm).mock.calls[0][0]
      expect(prompt).toContain('Not provided')
    })

    it('buildFixPrompt includes issues', () => {
      const content: ExerciseContent = {
        text: 'Problem',
        solutionText: 'Sol',
        difficulty: 3,
        topicNames: ['Math'],
      }
      const prompt = exerciseValidator.buildFixPrompt(content, ['ambiguous'], ['clarify'])

      expect(prompt).toContain('ambiguous')
      expect(prompt).toContain('clarify')
    })

    it('parseFixed extracts text, solutionText, difficulty', () => {
      const original: ExerciseContent = {
        text: 'old',
        solutionText: 'old sol',
        difficulty: 2,
        topicNames: ['Math'],
      }
      const result = exerciseValidator.parseFixed(
        '{ "text": "new problem", "solutionText": "new sol", "difficulty": 4 }',
        original,
      )

      expect(result.text).toBe('new problem')
      expect(result.solutionText).toBe('new sol')
      expect(result.difficulty).toBe(4)
      expect(result.topicNames).toEqual(['Math']) // preserved
    })
  })

  // ─── Grade Validator ─────────────────────────────────────────────

  describe('gradeValidator', () => {
    it('has correct metadata', () => {
      expect(gradeValidator.name).toBe('grade')
      expect(gradeValidator.minScore).toBe(0.7)
      expect(gradeValidator.maxAttempts).toBe(1)
    })

    it('validate sends grading content to LLM', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": 0.8, "issues": [], "suggestions": [] }')
      const content: GradeContent = {
        exerciseText: 'What is 2+2?',
        studentAnswer: '4',
        score: 1.0,
        feedback: 'Correct!',
        correctAnswer: '4',
      }

      await gradeValidator.validate(content, mockLlm)

      const prompt = vi.mocked(mockLlm).mock.calls[0][0]
      expect(prompt).toContain('What is 2+2?')
      expect(prompt).toContain('Student answer: 4')
      expect(prompt).toContain('Correct answer: 4')
      expect(prompt).toContain('Score given: 1')
    })

    it('validate omits correctAnswer when not provided', async () => {
      vi.mocked(mockLlm).mockResolvedValue('{ "score": 0.8, "issues": [], "suggestions": [] }')
      const content: GradeContent = {
        exerciseText: 'Problem',
        studentAnswer: 'Answer',
        score: 0.5,
        feedback: 'Partial',
      }

      await gradeValidator.validate(content, mockLlm)

      const prompt = vi.mocked(mockLlm).mock.calls[0][0]
      expect(prompt).not.toContain('Correct answer:')
    })

    it('buildFixPrompt includes exercise and issues', () => {
      const content: GradeContent = {
        exerciseText: 'Problem',
        studentAnswer: 'Answer',
        score: 0.5,
        feedback: 'Bad feedback',
      }
      const prompt = gradeValidator.buildFixPrompt(content, ['too harsh'], ['be constructive'])

      expect(prompt).toContain('too harsh')
      expect(prompt).toContain('be constructive')
      expect(prompt).toContain('Problem')
    })

    it('parseFixed extracts score and feedback', () => {
      const original: GradeContent = {
        exerciseText: 'Problem',
        studentAnswer: 'Answer',
        score: 0.3,
        feedback: 'old feedback',
      }
      const result = gradeValidator.parseFixed(
        '{ "score": 0.7, "feedback": "new feedback" }',
        original,
      )

      expect(result.score).toBe(0.7)
      expect(result.feedback).toBe('new feedback')
      expect(result.exerciseText).toBe('Problem') // preserved
    })

    it('parseFixed returns original on bad data', () => {
      const original: GradeContent = {
        exerciseText: 'Problem',
        studentAnswer: 'Answer',
        score: 0.5,
        feedback: 'feedback',
      }
      const result = gradeValidator.parseFixed('invalid', original)

      expect(result).toEqual(original)
    })
  })
})
