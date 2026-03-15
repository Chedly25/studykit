/**
 * Prompt builders for generate-from-source actions.
 * Pure functions — keeps prompt construction out of UI components.
 */

export function buildSummaryPrompt(title: string, chunks: string[]): string {
  const content = chunks.join('\n\n---\n\n')
  return `Please provide a comprehensive summary of the following document titled "${title}". Organize the summary with key points and main ideas.

Document content:
${content}`
}

export function buildFlashcardPrompt(title: string, chunks: string[]): string {
  const content = chunks.join('\n\n---\n\n')
  return `Based on the following document titled "${title}", generate a set of flashcards covering the key concepts, definitions, and important facts. Use the createFlashcardDeck tool to save them.

Document content:
${content}`
}

export function buildPracticeExamPrompt(title: string, chunks: string[], examType?: string): string {
  const content = chunks.join('\n\n---\n\n')
  const formatNote = examType ? ` in ${examType} style` : ''
  return `Generate practice questions based on the following document titled "${title}"${formatNote}. Present one question at a time, wait for my answer, tell me if I'm correct, explain why, log the result, then show the next question.

Source material:
${content}`
}
