/**
 * Grade dispute workflow — re-evaluates a graded answer when the student
 * thinks the grade is wrong. Takes the original question, student answer,
 * original grade/feedback, and the student's argument for why it's wrong.
 * Returns an updated assessment.
 */
import { streamChat } from '../client'

export interface DisputeInput {
  questionText: string
  correctAnswer: string
  studentAnswer: string
  originalIsCorrect: boolean
  originalFeedback: string
  originalPoints: number
  maxPoints: number
  studentArgument: string
  markingScheme?: string
}

export interface DisputeResult {
  accepted: boolean
  explanation: string
  updatedScore?: number
}

export async function evaluateDispute(
  input: DisputeInput,
  authToken: string,
): Promise<DisputeResult> {
  const rubricContext = input.markingScheme
    ? `\nMarking scheme:\n${input.markingScheme}`
    : ''

  const prompt = `You are a fair exam grader reviewing a grade dispute from a student.

QUESTION:
${input.questionText}

CORRECT ANSWER:
${input.correctAnswer}
${rubricContext}

STUDENT'S ANSWER:
${input.studentAnswer}

ORIGINAL GRADE: ${input.originalPoints}/${input.maxPoints} (${input.originalIsCorrect ? 'marked correct' : 'marked incorrect'})
ORIGINAL FEEDBACK: ${input.originalFeedback}

STUDENT'S DISPUTE:
"${input.studentArgument}"

TASK: Re-evaluate this answer fairly, considering the student's argument. Return ONLY valid JSON:

{
  "accepted": true/false,
  "explanation": "Clear explanation of your decision. If accepting, explain what was overlooked. If rejecting, explain why the original grade stands.",
  "updatedScore": <number, only if accepted — the new score out of ${input.maxPoints}>
}

Rules:
- Be fair. If the student's answer is substantively correct but was marked wrong due to formatting, phrasing, or a technicality, accept the dispute.
- If the student's argument reveals a genuine misunderstanding (they think their wrong answer is right for wrong reasons), reject the dispute and explain kindly.
- Do not accept disputes just because the student asked. Only accept if the answer genuinely deserves a different grade.
- If partially correct, you may award partial credit via updatedScore.`

  const response = await streamChat({
    messages: [{ id: crypto.randomUUID(), role: 'user', content: prompt }],
    system: 'You are a fair, rigorous exam grader. Return only valid JSON matching the requested schema. Be honest but kind.',
    tools: [],
    maxTokens: 512,
    authToken,
  })

  const text = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { accepted: false, explanation: 'Could not evaluate the dispute. Please try again.' }
  }

  const parsed = JSON.parse(jsonMatch[0]) as DisputeResult
  return {
    accepted: !!parsed.accepted,
    explanation: parsed.explanation ?? 'No explanation provided.',
    updatedScore: parsed.accepted ? parsed.updatedScore : undefined,
  }
}
