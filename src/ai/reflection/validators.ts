/**
 * Pre-built validators for the reflection loop.
 * Each validator knows how to check and fix a specific content type.
 */
import type { Validator, LlmFn, ValidationResult } from '../agents/types'

// ─── Helpers ─────────────────────────────────────────────────────

function parseValidationJSON(raw: string): ValidationResult {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return { score: 0.5, issues: ['Could not parse validation'], suggestions: [] }
    const parsed = JSON.parse(match[0]) as { score: number; issues?: string[]; suggestions?: string[] }
    return {
      score: Math.max(0, Math.min(1, parsed.score)),
      issues: parsed.issues ?? [],
      suggestions: parsed.suggestions ?? [],
    }
  } catch {
    return { score: 0.5, issues: ['Validation parse error'], suggestions: [] }
  }
}

function parseFixedJSON<T>(raw: string, original: T, extractFn: (parsed: Record<string, unknown>) => Partial<T>): T {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return original
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    return { ...original, ...extractFn(parsed) }
  } catch {
    return original
  }
}

// ─── Flashcard Validator ─────────────────────────────────────────

export interface FlashcardContent {
  front: string
  back: string
  topicName?: string
}

export const flashcardValidator: Validator<FlashcardContent> = {
  name: 'flashcard',
  minScore: 0.7,
  maxAttempts: 2,

  async validate(content: FlashcardContent, llm: LlmFn): Promise<ValidationResult> {
    const raw = await llm(
      `Rate this flashcard on a scale of 0-1 for study quality.

Front: ${content.front}
Back: ${content.back}
${content.topicName ? `Topic: ${content.topicName}` : ''}

Check for:
1. Cognitive level (tests understanding, not just recall?)
2. Clarity (unambiguous question and answer?)
3. Conciseness (no unnecessary verbosity?)
4. Completeness (answer fully addresses the question?)

Return JSON: { "score": 0.0-1.0, "issues": ["..."], "suggestions": ["..."] }
Only JSON, nothing else.`,
      'You are a flashcard quality assessor. Return only valid JSON.',
    )
    return parseValidationJSON(raw)
  },

  buildFixPrompt(content: FlashcardContent, issues: string[], suggestions: string[]): string {
    return `Fix this flashcard based on the issues found.

Current card:
Front: ${content.front}
Back: ${content.back}

Issues: ${issues.join('; ')}
Suggestions: ${suggestions.join('; ')}

Return JSON: { "front": "improved question", "back": "improved answer" }
Only JSON, nothing else.`
  },

  parseFixed(raw: string, original: FlashcardContent): FlashcardContent {
    return parseFixedJSON(raw, original, (p) => ({
      ...(typeof p.front === 'string' ? { front: p.front } : {}),
      ...(typeof p.back === 'string' ? { back: p.back } : {}),
    }))
  },
}

// ─── Concept Card Validator ──────────────────────────────────────

export interface ConceptCardContent {
  title: string
  content: string
  keyPoints: string[]
  sourceContent?: string
}

export const conceptCardValidator: Validator<ConceptCardContent> = {
  name: 'concept-card',
  minScore: 0.7,
  maxAttempts: 2,

  async validate(content: ConceptCardContent, llm: LlmFn): Promise<ValidationResult> {
    const raw = await llm(
      `Rate this concept card on a scale of 0-1 for study reference quality.

Title: ${content.title}
Content: ${content.content.slice(0, 2000)}
Key Points: ${content.keyPoints.join(', ')}
${content.sourceContent ? `Source excerpt: ${content.sourceContent.slice(0, 1000)}` : ''}

Check for:
1. Completeness (covers the concept adequately?)
2. Accuracy (consistent with source material if provided?)
3. Structure (has clear sections: definition, key points, examples?)
4. Clarity (understandable without ambiguity?)

Return JSON: { "score": 0.0-1.0, "issues": ["..."], "suggestions": ["..."] }
Only JSON, nothing else.`,
      'You are an academic content quality assessor. Return only valid JSON.',
    )
    return parseValidationJSON(raw)
  },

  buildFixPrompt(content: ConceptCardContent, issues: string[], suggestions: string[]): string {
    return `Improve this concept card based on the issues found.

Title: ${content.title}
Current content: ${content.content.slice(0, 2000)}
Key Points: ${content.keyPoints.join(', ')}

Issues: ${issues.join('; ')}
Suggestions: ${suggestions.join('; ')}

Return JSON: { "title": "...", "content": "improved markdown", "keyPoints": ["..."] }
Only JSON, nothing else.`
  },

  parseFixed(raw: string, original: ConceptCardContent): ConceptCardContent {
    return parseFixedJSON(raw, original, (p) => ({
      ...(typeof p.title === 'string' ? { title: p.title } : {}),
      ...(typeof p.content === 'string' ? { content: p.content } : {}),
      ...(Array.isArray(p.keyPoints) ? { keyPoints: p.keyPoints as string[] } : {}),
    }))
  },
}

// ─── Exercise Validator ──────────────────────────────────────────

export interface ExerciseContent {
  text: string
  solutionText?: string
  difficulty: number
  topicNames: string[]
}

export const exerciseValidator: Validator<ExerciseContent> = {
  name: 'exercise',
  minScore: 0.7,
  maxAttempts: 2,

  async validate(content: ExerciseContent, llm: LlmFn): Promise<ValidationResult> {
    const raw = await llm(
      `Rate this exercise on a scale of 0-1 for educational quality.

Exercise: ${content.text.slice(0, 2000)}
Solution: ${content.solutionText?.slice(0, 1000) ?? 'Not provided'}
Difficulty: ${content.difficulty}/5
Topics: ${content.topicNames.join(', ')}

Check for:
1. Solvability (can a student actually solve this with the info given?)
2. Difficulty accuracy (matches stated difficulty level?)
3. Solution correctness (solution is accurate and complete?)
4. Clarity (unambiguous problem statement?)

Return JSON: { "score": 0.0-1.0, "issues": ["..."], "suggestions": ["..."] }
Only JSON, nothing else.`,
      'You are an educational exercise quality assessor. Return only valid JSON.',
    )
    return parseValidationJSON(raw)
  },

  buildFixPrompt(content: ExerciseContent, issues: string[], suggestions: string[]): string {
    return `Improve this exercise based on the issues found.

Current exercise: ${content.text.slice(0, 2000)}
Current solution: ${content.solutionText?.slice(0, 1000) ?? 'None'}
Difficulty: ${content.difficulty}/5

Issues: ${issues.join('; ')}
Suggestions: ${suggestions.join('; ')}

Return JSON: { "text": "improved exercise", "solutionText": "improved solution", "difficulty": N }
Only JSON, nothing else.`
  },

  parseFixed(raw: string, original: ExerciseContent): ExerciseContent {
    return parseFixedJSON(raw, original, (p) => ({
      ...(typeof p.text === 'string' ? { text: p.text } : {}),
      ...(typeof p.solutionText === 'string' ? { solutionText: p.solutionText } : {}),
      ...(typeof p.difficulty === 'number' ? { difficulty: p.difficulty } : {}),
    }))
  },
}

// ─── Grade Validator ─────────────────────────────────────────────

export interface GradeContent {
  exerciseText: string
  studentAnswer: string
  score: number
  feedback: string
  correctAnswer?: string
}

export const gradeValidator: Validator<GradeContent> = {
  name: 'grade',
  minScore: 0.7,
  maxAttempts: 1,

  async validate(content: GradeContent, llm: LlmFn): Promise<ValidationResult> {
    const raw = await llm(
      `Check this grading for consistency and quality.

Exercise: ${content.exerciseText.slice(0, 1500)}
Student answer: ${content.studentAnswer.slice(0, 1000)}
${content.correctAnswer ? `Correct answer: ${content.correctAnswer.slice(0, 1000)}` : ''}
Score given: ${content.score}
Feedback: ${content.feedback}

Check for:
1. Score consistency (does the score match the quality of the answer?)
2. Feedback quality (constructive, specific, actionable?)
3. Fairness (no harsh or misleading feedback?)

Return JSON: { "score": 0.0-1.0, "issues": ["..."], "suggestions": ["..."] }
Only JSON, nothing else.`,
      'You are a grading quality assessor. Return only valid JSON.',
    )
    return parseValidationJSON(raw)
  },

  buildFixPrompt(content: GradeContent, issues: string[], suggestions: string[]): string {
    return `Improve this grading based on the issues found.

Exercise: ${content.exerciseText.slice(0, 1500)}
Student answer: ${content.studentAnswer.slice(0, 1000)}
Current score: ${content.score}
Current feedback: ${content.feedback}

Issues: ${issues.join('; ')}
Suggestions: ${suggestions.join('; ')}

Return JSON: { "score": 0.0-1.0, "feedback": "improved feedback" }
Only JSON, nothing else.`
  },

  parseFixed(raw: string, original: GradeContent): GradeContent {
    return parseFixedJSON(raw, original, (p) => ({
      ...(typeof p.score === 'number' ? { score: p.score } : {}),
      ...(typeof p.feedback === 'string' ? { feedback: p.feedback } : {}),
    }))
  },
}
