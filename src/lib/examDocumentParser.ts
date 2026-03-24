/**
 * Parses a CPGE-style exam document (Markdown+LaTeX) into segments.
 *
 * The AI generates the exam as a single continuous markdown string with numbered questions.
 * This parser splits it into prose (introductions, definitions, notation) and question segments
 * so the renderer can insert answer textareas after each question.
 *
 * Supports question markers like:
 *   1. Montrer que...
 *   **1.** Montrer que...
 *   1) Montrer que...
 *   **Question 1.** Montrer que...
 */

export interface DocumentSegment {
  type: 'prose' | 'question'
  content: string
  questionNumber?: number
}

export interface ParsedExamDocument {
  segments: DocumentSegment[]
  questionCount: number
}

// Matches lines that start a new numbered question.
// Captures the question number.
// Patterns:
//   "1. "  /  "**1.** "  /  "1) "  /  "**Question 1.** "  /  "**Question 1 :** "
const QUESTION_LINE_RE = /^(?:\*{0,2})(?:Question\s+)?(\d+)(?:[\.\)]|\ :)\*{0,2}\s/

/**
 * Detect if a line starts a new question and return its number, or null.
 */
function detectQuestionStart(line: string): number | null {
  const m = line.match(QUESTION_LINE_RE)
  if (!m) return null
  return parseInt(m[1], 10)
}

/**
 * Parse a full exam markdown document into interleaved prose/question segments.
 */
export function parseExamDocument(markdown: string): ParsedExamDocument {
  if (!markdown || !markdown.trim()) {
    return { segments: [], questionCount: 0 }
  }

  const lines = markdown.split('\n')
  const segments: DocumentSegment[] = []
  let currentLines: string[] = []
  let currentType: 'prose' | 'question' = 'prose'
  let currentQuestionNumber: number | undefined
  let maxQuestion = 0

  function flushSegment() {
    const content = currentLines.join('\n').trim()
    if (content) {
      segments.push({
        type: currentType,
        content,
        questionNumber: currentType === 'question' ? currentQuestionNumber : undefined,
      })
    }
    currentLines = []
  }

  for (const line of lines) {
    const qNum = detectQuestionStart(line)

    if (qNum !== null) {
      // Flush whatever we had before this question
      flushSegment()
      currentType = 'question'
      currentQuestionNumber = qNum
      if (qNum > maxQuestion) maxQuestion = qNum
      currentLines.push(line)
    } else if (currentType === 'question') {
      // Check if this line is a section header or a block of prose that starts a new part
      // Part headers like "## II  Endomorphismes de rang 1" break out of a question
      const isPartHeader = /^#{1,3}\s/.test(line)
      // A blank line followed by a paragraph might still be part of the question (multi-line question)
      // But a major header definitely starts a new prose block
      if (isPartHeader) {
        flushSegment()
        currentType = 'prose'
        currentQuestionNumber = undefined
        currentLines.push(line)
      } else {
        currentLines.push(line)
      }
    } else {
      // Prose mode
      currentLines.push(line)
    }
  }

  // Flush remaining
  flushSegment()

  return { segments, questionCount: maxQuestion }
}

/**
 * Extract question numbers that have non-empty answers.
 */
export function getAnsweredQuestions(answers: Record<number, string>): Set<number> {
  const answered = new Set<number>()
  for (const [num, text] of Object.entries(answers)) {
    if (text && text.trim().length > 0) {
      answered.add(Number(num))
    }
  }
  return answered
}
