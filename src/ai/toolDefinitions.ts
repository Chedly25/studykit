/**
 * Tool definitions in Anthropic tool_use format.
 * These tell the AI what tools it can call.
 */
import type { ToolDefinition } from './types'

export const agentTools: ToolDefinition[] = [
  // ─── Knowledge State (Read) ───────────────────────────────
  {
    name: 'getKnowledgeGraph',
    description: 'Get the full knowledge graph: all subjects and topics with mastery scores for the active exam profile.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'getWeakTopics',
    description: 'Get the student\'s weakest topics sorted by mastery, optionally limited to a count.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of weak topics to return (default 10)' },
      },
    },
  },
  {
    name: 'getReadinessScore',
    description: 'Get the overall exam readiness score (0-100%) based on weighted subject mastery vs. passing threshold.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'getStudyStats',
    description: 'Get study statistics: streak, weekly hours, total sessions, question accuracy.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'getDueFlashcards',
    description: 'Get flashcards due for review today, optionally filtered by topic.',
    input_schema: {
      type: 'object',
      properties: {
        topicId: { type: 'string', description: 'Optional topic ID to filter by' },
      },
    },
  },
  {
    name: 'getUpcomingDeadlines',
    description: 'Get upcoming assignments and deadlines within the next N days.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to look ahead (default 7)' },
      },
    },
  },

  // ─── Content Generation ───────────────────────────────────
  {
    name: 'generateQuestions',
    description: 'Generate practice questions for a specific topic in the exam\'s format. Returns a prompt instruction — the AI should then generate the questions in the response.',
    input_schema: {
      type: 'object',
      properties: {
        topicName: { type: 'string', description: 'The topic to generate questions for' },
        count: { type: 'number', description: 'Number of questions (default 3)' },
        difficulty: { type: 'number', description: 'Difficulty 1-5 (default 3)' },
        format: { type: 'string', description: 'Question format: multiple-choice, true-false, short-answer, essay, vignette' },
      },
      required: ['topicName'],
    },
  },
  {
    name: 'generateFlashcards',
    description: 'Generate flashcards for a topic and add them to a deck.',
    input_schema: {
      type: 'object',
      properties: {
        topicName: { type: 'string', description: 'Topic to create flashcards for' },
        count: { type: 'number', description: 'Number of flashcards (default 5)' },
        deckName: { type: 'string', description: 'Name for the flashcard deck' },
      },
      required: ['topicName'],
    },
  },

  // ─── Data Operations ──────────────────────────────────────
  {
    name: 'logQuestionResult',
    description: 'Log the result of a practice question, updating the student\'s mastery for that topic.',
    input_schema: {
      type: 'object',
      properties: {
        topicName: { type: 'string', description: 'Topic the question belongs to' },
        question: { type: 'string', description: 'The question text' },
        userAnswer: { type: 'string', description: 'What the student answered' },
        correctAnswer: { type: 'string', description: 'The correct answer' },
        isCorrect: { type: 'boolean', description: 'Whether the student got it right' },
        difficulty: { type: 'number', description: 'Question difficulty 1-5' },
        explanation: { type: 'string', description: 'Explanation of the correct answer' },
        errorType: { type: 'string', enum: ['recall', 'conceptual', 'application', 'distractor'], description: 'Type of error if incorrect' },
      },
      required: ['topicName', 'question', 'userAnswer', 'correctAnswer', 'isCorrect'],
    },
  },
  {
    name: 'getCalibrationData',
    description: 'Get topics where student\'s confidence doesn\'t match actual mastery. Identifies overconfident and underconfident topics.',
    input_schema: {
      type: 'object',
      properties: {
        threshold: { type: 'number', description: 'Minimum gap to flag (default 0.2)' },
      },
    },
  },
  {
    name: 'getErrorPatterns',
    description: 'Get error pattern analysis showing what types of mistakes the student makes per topic.',
    input_schema: {
      type: 'object',
      properties: {
        topicName: { type: 'string', description: 'Optional topic name to filter by' },
      },
    },
  },
  {
    name: 'generateStudyPlan',
    description: 'Generate a personalized multi-day study plan based on the student\'s knowledge graph, exam date, and weak areas.',
    input_schema: {
      type: 'object',
      properties: {
        daysAhead: { type: 'number', description: 'Number of days to plan ahead (default 7)' },
      },
    },
  },
  {
    name: 'getStudyPlan',
    description: 'Get the active study plan with today\'s activities and upcoming days.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'updateTopicConfidence',
    description: 'Update the student\'s self-reported confidence for a topic (0-1).',
    input_schema: {
      type: 'object',
      properties: {
        topicName: { type: 'string', description: 'Topic name' },
        confidence: { type: 'number', description: 'Confidence score 0-1' },
      },
      required: ['topicName', 'confidence'],
    },
  },
  {
    name: 'createFlashcardDeck',
    description: 'Create a new flashcard deck with cards.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Deck name' },
        topicName: { type: 'string', description: 'Associated topic name' },
        cards: {
          type: 'array',
          description: 'Array of {front, back} card objects',
          items: {
            type: 'object',
            properties: {
              front: { type: 'string' },
              back: { type: 'string' },
            },
            required: ['front', 'back'],
          },
        },
      },
      required: ['name', 'cards'],
    },
  },
  {
    name: 'addAssignment',
    description: 'Add a new assignment or deadline.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD' },
        priority: { type: 'string', description: 'low, medium, or high' },
      },
      required: ['title', 'dueDate'],
    },
  },
  {
    name: 'getStudyRecommendation',
    description: 'Get a personalized study recommendation based on weak topics, exam proximity, and study patterns.',
    input_schema: { type: 'object', properties: {} },
  },

  // ─── Source Retrieval ──────────────────────────────────────
  {
    name: 'searchSources',
    description: 'Search uploaded documents for relevant content. Returns the most relevant chunks from the student\'s uploaded sources.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to find relevant content' },
        topN: { type: 'number', description: 'Number of results to return (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'getDocumentContent',
    description: 'Get the full content of a specific uploaded document.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The document ID to retrieve' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'listSources',
    description: 'List all uploaded documents with metadata (title, type, word count).',
    input_schema: { type: 'object', properties: {} },
  },
]
