/**
 * Mock exam tools — grading and management.
 */
import { db } from '../../db'
import { streamChat } from '../client'

export async function gradeMockExam(
  examProfileId: string,
  input: { examId: string },
  authToken: string,
): Promise<string> {
  const exam = await db.mockExams.get(input.examId)
  if (!exam) return JSON.stringify({ error: 'Mock exam not found' })
  if (exam.status === 'graded') {
    return JSON.stringify({
      alreadyGraded: true,
      totalScore: exam.totalScore,
      maxScore: exam.maxScore,
      feedback: JSON.parse(exam.feedback || '{}'),
    })
  }

  const sections = JSON.parse(exam.sections) as Array<{
    formatId: string
    formatName: string
    questions: Array<{ question: string; answer: string }>
  }>

  const prompt = `Grade this mock exam. For each section, evaluate each answer and provide a score.

Exam sections:
${sections.map((s, i) => `
Section ${i + 1}: ${s.formatName}
${s.questions.map((q, j) => `Q${j + 1}: ${q.question}
Student's answer: ${q.answer}`).join('\n\n')}`).join('\n\n---\n\n')}

Return ONLY valid JSON:
{
  "sections": [
    {
      "formatName": "section name",
      "score": 75,
      "maxScore": 100,
      "feedback": "Overall feedback for this section",
      "questionFeedback": [
        { "questionIndex": 0, "score": 8, "maxScore": 10, "feedback": "..." }
      ]
    }
  ],
  "overallFeedback": "Summary feedback",
  "strengths": ["strength 1"],
  "areasForImprovement": ["area 1"]
}`

  try {
    const response = await streamChat({
      messages: [{ role: 'user', content: prompt }],
      system: 'You are an expert exam grader. Grade fairly and provide constructive feedback. Return only valid JSON.',
      tools: [],
      authToken,
    })

    const text = response.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return JSON.stringify({ error: 'Failed to parse grading response' })

    const grading = JSON.parse(jsonMatch[0]) as {
      sections: Array<{ score: number; maxScore: number }>
      overallFeedback: string
    }

    const totalScore = grading.sections.reduce((s, sec) => s + sec.score, 0)
    const maxScore = grading.sections.reduce((s, sec) => s + sec.maxScore, 0)

    await db.mockExams.update(input.examId, {
      status: 'graded',
      totalScore,
      maxScore,
      endTime: new Date().toISOString(),
      feedback: jsonMatch[0],
    })

    return JSON.stringify({
      success: true,
      totalScore,
      maxScore,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      feedback: grading,
    }, null, 2)
  } catch {
    return JSON.stringify({ error: 'Failed to grade exam' })
  }
}

export async function createMockExam(
  examProfileId: string,
  input: { timeLimitMinutes: number; formatIds?: string[] },
): Promise<string> {
  const formats = await db.examFormats.where('examProfileId').equals(examProfileId).toArray()

  const selectedFormats = input.formatIds
    ? formats.filter(f => input.formatIds!.includes(f.id))
    : formats

  if (selectedFormats.length === 0) {
    return JSON.stringify({ error: 'No exam formats defined. Create exam formats first.' })
  }

  const sections = selectedFormats.map(f => ({
    formatId: f.id,
    formatName: f.formatName,
    questions: [] as Array<{ question: string; answer: string }>,
  }))

  const exam = {
    id: crypto.randomUUID(),
    examProfileId,
    startTime: new Date().toISOString(),
    timeLimitMinutes: input.timeLimitMinutes,
    sections: JSON.stringify(sections),
    status: 'in-progress' as const,
  }

  await db.mockExams.put(exam)

  return JSON.stringify({
    success: true,
    examId: exam.id,
    timeLimitMinutes: exam.timeLimitMinutes,
    sections: selectedFormats.map(f => ({
      formatName: f.formatName,
      timeAllocation: f.timeAllocation,
      questionCount: f.questionCount,
    })),
  })
}
