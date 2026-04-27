/**
 * Server-owned tool definitions in OpenAI function-calling format.
 * The server uses these canonical definitions instead of trusting client-provided
 * tool schemas, preventing prompt injection via tool description/parameter fields.
 *
 * When a client requests tools by name, the server looks up the definition here
 * and ignores whatever description/parameters the client sent.
 */

interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

function tool(name: string, description: string, parameters: Record<string, unknown>): OpenAITool {
  return { type: 'function', function: { name, description, parameters } }
}

const p = (props: Record<string, unknown>, required?: string[]) => ({
  type: 'object',
  properties: props,
  ...(required ? { required } : {}),
})

const TOOL_LIST: OpenAITool[] = [
  // Knowledge State
  tool('getKnowledgeGraph', 'Get the full knowledge graph with mastery scores.', p({})),
  tool('getWeakTopics', 'Get weakest topics sorted by mastery.', p({ limit: { type: 'number' } })),
  tool('getReadinessScore', 'Get overall exam readiness score (0-100%).', p({})),
  tool('getStudyStats', 'Get study statistics: streak, weekly hours, sessions, accuracy.', p({})),
  tool('getDueFlashcards', 'Get flashcards due for review today.', p({ topicId: { type: 'string' } })),
  tool('getUpcomingDeadlines', 'Get upcoming assignments within N days.', p({ days: { type: 'number' } })),
  tool('getFlashcardPerformance', 'Get flashcard performance per deck.', p({})),
  tool('getErrorPatterns', 'Get error pattern analysis per topic.', p({ topicName: { type: 'string' } })),
  tool('getCalibrationData', 'Get topics with confidence-mastery mismatch.', p({ threshold: { type: 'number' } })),

  // Data Operations
  tool('logQuestionResult', 'Log a practice question result.', p({
    topicName: { type: 'string' }, question: { type: 'string' },
    userAnswer: { type: 'string' }, correctAnswer: { type: 'string' },
    isCorrect: { type: 'boolean' }, difficulty: { type: 'number' },
    explanation: { type: 'string' },
    errorType: { type: 'string', enum: ['recall', 'conceptual', 'application', 'distractor'] },
  }, ['topicName', 'question', 'userAnswer', 'correctAnswer', 'isCorrect'])),
  tool('updateTopicConfidence', 'Update self-reported confidence for a topic.', p({
    topicName: { type: 'string' }, confidence: { type: 'number' },
  }, ['topicName', 'confidence'])),
  tool('createFlashcardDeck', 'Create a flashcard deck with cards.', p({
    name: { type: 'string' }, topicName: { type: 'string' },
    cards: { type: 'array', items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } }, required: ['front', 'back'] } },
  }, ['name', 'cards'])),
  tool('addAssignment', 'Add a new assignment or deadline.', p({
    title: { type: 'string' }, description: { type: 'string' },
    dueDate: { type: 'string' }, priority: { type: 'string' },
  }, ['title', 'dueDate'])),
  tool('getStudyRecommendation', 'Get personalized study recommendation.', p({})),

  // Sources
  tool('searchSources', 'Search uploaded documents for relevant content.', p({
    query: { type: 'string' }, topN: { type: 'number' },
  }, ['query'])),
  tool('getDocumentContent', 'Get full content of an uploaded document.', p({
    documentId: { type: 'string' },
  }, ['documentId'])),
  tool('listSources', 'List all uploaded documents with metadata.', p({})),
  tool('searchWeb', 'Search the internet for information.', p({
    query: { type: 'string' }, maxResults: { type: 'number' },
  }, ['query'])),
  tool('searchLegalCodes', 'Search French legal codes (Code civil, Code pénal, Code du travail, etc.) for articles relevant to a legal question. Returns article text with exact article numbers and code references.', p({
    query: { type: 'string', description: 'Natural language legal question in French' },
    codeName: { type: 'string', description: 'Optional: filter to a specific code (e.g., "Code civil")' },
    topK: { type: 'number', description: 'Number of results (default 10)' },
  }, ['query'])),
  tool('searchUserCours', 'Search the student\'s own uploaded cours / lecture notes for content relevant to a question. Use when the question references her cours or her professor\'s framing. Cours extracts are pedagogical material, NOT a source of law.', p({
    query: { type: 'string', description: 'Natural language query keyed to the topic of interest' },
    topK: { type: 'number', description: 'Number of extracts to return (default 8)' },
  }, ['query'])),

  // Plans
  tool('generateStudyPlan', 'Generate a personalized multi-day study plan.', p({ daysAhead: { type: 'number' } })),
  tool('getStudyPlan', 'Get the active study plan.', p({})),
  tool('adjustStudyPlan', 'Adjust the active study plan.', p({ reason: { type: 'string' } }, ['reason'])),

  // Student Memory
  tool('getStudentModel', 'Load persistent student learning model.', p({})),
  tool('updateStudentModel', 'Record observations about the student.', p({
    learningStyle: { type: 'object' }, commonMistakes: { type: 'array', items: { type: 'string' } },
    personalityNotes: { type: 'array', items: { type: 'string' } },
    preferredExplanations: { type: 'array', items: { type: 'string' } },
    motivationTriggers: { type: 'array', items: { type: 'string' } },
  })),
  tool('getConversationHistory', 'Search past conversation summaries.', p({
    keyword: { type: 'string' }, topicName: { type: 'string' },
  })),
  tool('getRecentSessions', 'Get most recent conversation summaries.', p({ limit: { type: 'number' } })),

  // Topic Dependencies
  tool('getTopicDependencies', 'Get prerequisites and dependents for a topic.', p({
    topicName: { type: 'string' },
  }, ['topicName'])),
  tool('setTopicPrerequisites', 'Set prerequisite topics.', p({
    topicName: { type: 'string' },
    prerequisiteNames: { type: 'array', items: { type: 'string' } },
  }, ['topicName', 'prerequisiteNames'])),

  // Concept Extraction
  tool('autoMapSourceToTopics', 'Extract concepts from a document and map to topics.', p({
    documentId: { type: 'string' },
  }, ['documentId'])),

  // Flashcard Review
  tool('startQuickReview', 'Pull due flashcards for in-chat review.', p({
    topicName: { type: 'string' }, limit: { type: 'number' },
  })),
  tool('rateFlashcard', 'Apply SM-2 rating to a flashcard.', p({
    cardId: { type: 'string' }, rating: { type: 'number' },
  }, ['cardId', 'rating'])),

  // Rich UI
  tool('renderConceptCard', 'Render a focused concept card.', p({
    title: { type: 'string' }, content: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    example: { type: 'string' },
    connections: { type: 'array', items: { type: 'string' } },
    sourceReference: { type: 'string' },
  }, ['title', 'keyPoints'])),
  tool('renderQuiz', 'Render an interactive quiz.', p({
    questions: {
      type: 'array', items: {
        type: 'object', properties: {
          question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } },
          correctIndex: { type: 'number' }, explanation: { type: 'string' },
        }, required: ['question', 'options', 'correctIndex', 'explanation'],
      },
    },
  }, ['questions'])),
  tool('renderCodePlayground', 'Render an interactive code editor.', p({
    code: { type: 'string' }, language: { type: 'string', enum: ['python', 'javascript'] },
    instructions: { type: 'string' },
  }, ['code', 'language', 'instructions'])),
  tool('executeSequence', 'Execute a sequence of tools in order.', p({
    steps: {
      type: 'array', items: {
        type: 'object', properties: { toolName: { type: 'string' }, input: { type: 'object' } },
        required: ['toolName', 'input'],
      },
    },
  }, ['steps'])),

  // Research
  tool('getResearchThreads', 'Get all research threads with status.', p({})),
  tool('updateThreadStatus', 'Update research thread status.', p({
    topicName: { type: 'string' }, status: { type: 'string', enum: ['exploring', 'active', 'blocked', 'resolved'] },
  }, ['topicName', 'status'])),
  tool('getMilestones', 'Get all research milestones.', p({})),
  tool('updateMilestone', 'Update milestone status.', p({
    milestoneId: { type: 'string' }, status: { type: 'string', enum: ['pending', 'in-progress', 'done'] },
  }, ['milestoneId', 'status'])),
  tool('synthesizeLiterature', 'Gather content for literature synthesis.', p({
    documentIds: { type: 'array', items: { type: 'string' } },
  })),
  tool('searchNotes', 'Search research notes by keyword.', p({ query: { type: 'string' } }, ['query'])),

  // Article Review
  tool('searchReviewArticles', 'Search across review articles.', p({
    query: { type: 'string' }, projectId: { type: 'string' },
  }, ['query'])),
  tool('getArticleComparison', 'Compare review articles side-by-side.', p({
    articleIds: { type: 'array', items: { type: 'string' } },
  }, ['articleIds'])),
  tool('getReviewProjectSummary', 'Get review project summary.', p({
    projectId: { type: 'string' },
  }, ['projectId'])),
]

export const SERVER_TOOLS: ReadonlyMap<string, OpenAITool> = new Map(
  TOOL_LIST.map(t => [t.function.name, t])
)
