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

  {
    name: 'getFlashcardPerformance',
    description: 'Get detailed flashcard performance per deck: card count, retention rate, due count, average ease factor.',
    input_schema: { type: 'object', properties: {} },
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

  // ─── Student Memory ─────────────────────────────────────
  {
    name: 'getStudentModel',
    description: 'Load the persistent student model with observed learning patterns, common mistakes, personality notes, and preferred explanation styles.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'updateStudentModel',
    description: 'Record new observations about the student after teaching. Merges with existing data. Use this after substantive interactions to build up a persistent model of the student.',
    input_schema: {
      type: 'object',
      properties: {
        learningStyle: { type: 'object', description: 'Key-value observations about learning style (e.g. {"visual": true, "prefersExamples": true})' },
        commonMistakes: { type: 'array', items: { type: 'string' }, description: 'Patterns of mistakes observed (e.g. "Confuses mitosis and meiosis")' },
        personalityNotes: { type: 'array', items: { type: 'string' }, description: 'Observations about personality and interaction style' },
        preferredExplanations: { type: 'array', items: { type: 'string' }, description: 'What types of explanations work best (e.g. "Responds well to real-world analogies")' },
        motivationTriggers: { type: 'array', items: { type: 'string' }, description: 'What motivates or demotivates the student' },
      },
    },
  },
  {
    name: 'getConversationHistory',
    description: 'Search past conversation summaries by keyword or topic name. Returns matching sessions with topics covered and outcomes.',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Search keyword to match in topics or outcomes' },
        topicName: { type: 'string', description: 'Filter by topic name' },
      },
    },
  },
  {
    name: 'getRecentSessions',
    description: 'Get the most recent conversation summaries to understand what was covered in past sessions.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of recent sessions to return (default 5)' },
      },
    },
  },

  // ─── Topic Dependencies ─────────────────────────────────
  {
    name: 'getTopicDependencies',
    description: 'Get prerequisites and dependents for a topic. Shows which topics must be mastered first and which topics depend on this one.',
    input_schema: {
      type: 'object',
      properties: {
        topicName: { type: 'string', description: 'Topic name to look up dependencies for' },
      },
      required: ['topicName'],
    },
  },
  {
    name: 'setTopicPrerequisites',
    description: 'Set prerequisite topics that should be mastered before a given topic. AI can auto-detect these from source materials.',
    input_schema: {
      type: 'object',
      properties: {
        topicName: { type: 'string', description: 'Topic to set prerequisites for' },
        prerequisiteNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of prerequisite topic names',
        },
      },
      required: ['topicName', 'prerequisiteNames'],
    },
  },

  // ─── Plan Management ───────────────────────────────────
  {
    name: 'adjustStudyPlan',
    description: 'Adjust the active study plan based on current progress. Regenerates remaining days while preserving completed work.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason for replanning (e.g. "2 days skipped", "mastery changed significantly")' },
      },
      required: ['reason'],
    },
  },

  // ─── Concept Extraction ────────────────────────────────
  {
    name: 'autoMapSourceToTopics',
    description: 'Automatically extract concepts from an uploaded document and map them to existing topics.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Document ID to extract concepts from' },
      },
      required: ['documentId'],
    },
  },

  // ─── Flashcard Review in Chat ──────────────────────────
  {
    name: 'startQuickReview',
    description: 'Pull due flashcards for an in-chat quick review session. Returns cards one at a time for the student to answer.',
    input_schema: {
      type: 'object',
      properties: {
        topicName: { type: 'string', description: 'Optional topic to filter cards by' },
        limit: { type: 'number', description: 'Max number of cards to review (default 5)' },
      },
    },
  },
  {
    name: 'rateFlashcard',
    description: 'Apply SM-2 rating to a flashcard after the student reviews it in chat. Rating: 0=again, 3=hard, 4=good, 5=easy.',
    input_schema: {
      type: 'object',
      properties: {
        cardId: { type: 'string', description: 'Flashcard ID' },
        rating: { type: 'number', description: 'SM-2 rating: 0 (again), 3 (hard), 4 (good), 5 (easy)' },
      },
      required: ['cardId', 'rating'],
    },
  },

  // ─── Mock Exams ────────────────────────────────────────
  {
    name: 'createMockExam',
    description: 'Create a new timed mock exam session using defined exam formats.',
    input_schema: {
      type: 'object',
      properties: {
        timeLimitMinutes: { type: 'number', description: 'Time limit in minutes' },
        formatIds: { type: 'array', items: { type: 'string' }, description: 'Optional specific format IDs to include' },
      },
      required: ['timeLimitMinutes'],
    },
  },
  {
    name: 'gradeMockExam',
    description: 'Grade a completed mock exam using AI. Returns per-section scores and detailed feedback.',
    input_schema: {
      type: 'object',
      properties: {
        examId: { type: 'string', description: 'Mock exam ID to grade' },
      },
      required: ['examId'],
    },
  },

  // ─── Research Tools ─────────────────────────────────────────
  {
    name: 'getResearchThreads',
    description: 'Get all research threads (topics) with their status (exploring/active/blocked/resolved) and depth for research profiles.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'updateThreadStatus',
    description: 'Update the status of a research thread. Valid statuses: exploring, active, blocked, resolved.',
    input_schema: {
      type: 'object',
      properties: {
        topicName: { type: 'string', description: 'Name of the research thread' },
        status: { type: 'string', enum: ['exploring', 'active', 'blocked', 'resolved'], description: 'New status' },
      },
      required: ['topicName', 'status'],
    },
  },
  {
    name: 'getMilestones',
    description: 'Get all milestones for the research project with their status and target dates.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'updateMilestone',
    description: 'Update the status of a milestone. Valid statuses: pending, in-progress, done.',
    input_schema: {
      type: 'object',
      properties: {
        milestoneId: { type: 'string', description: 'Milestone ID' },
        status: { type: 'string', enum: ['pending', 'in-progress', 'done'], description: 'New status' },
      },
      required: ['milestoneId', 'status'],
    },
  },
  {
    name: 'synthesizeLiterature',
    description: 'Gather content from specified documents for literature synthesis. Returns document content and an instruction to synthesize themes, contradictions, and gaps.',
    input_schema: {
      type: 'object',
      properties: {
        documentIds: { type: 'array', items: { type: 'string' }, description: 'Optional document IDs. If empty, uses all documents.' },
      },
    },
  },
  {
    name: 'generateMeetingPrep',
    description: 'Gather recent research activity, blocked threads, and milestone progress to generate a structured advisor meeting preparation document.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'searchNotes',
    description: 'Search research notes by keyword in title, content, and tags.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'findNoteConnections',
    description: 'Find related research notes based on content similarity. Helps discover connections in Zettelkasten-style note systems.',
    input_schema: {
      type: 'object',
      properties: {
        noteId: { type: 'string', description: 'ID of the note to find connections for' },
      },
      required: ['noteId'],
    },
  },

  // ─── Article Review ──────────────────────────────────────────
  {
    name: 'searchReviewArticles',
    description: 'Search across review project articles using semantic search. Finds relevant content from uploaded PDFs in article review projects.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to find relevant content across review articles' },
        projectId: { type: 'string', description: 'Optional project ID to scope the search' },
      },
      required: ['query'],
    },
  },
  {
    name: 'getArticleComparison',
    description: 'Get a side-by-side comparison of 2 or more review articles including scores, analysis, and research context.',
    input_schema: {
      type: 'object',
      properties: {
        articleIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of article IDs to compare (minimum 2)',
        },
      },
      required: ['articleIds'],
    },
  },
  {
    name: 'getReviewProjectSummary',
    description: 'Get a summary of a review project including stats, synthesis themes, and ranking.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Review project ID' },
      },
      required: ['projectId'],
    },
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
  // ─── Rich UI Rendering ─────────────────────────────────────
  {
    name: 'renderConceptCard',
    description: 'Render a structured concept card inline. Use this INSTEAD of long text explanations when teaching a concept. The card will be saved to the student\'s knowledge board.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Concept name/title' },
        keyPoints: {
          type: 'array',
          items: { type: 'string' },
          description: '3-5 key bullet points about this concept',
        },
        example: { type: 'string', description: 'A concrete example illustrating the concept' },
        connections: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of related concepts',
        },
        sourceReference: { type: 'string', description: 'Citation from student materials (e.g., "Ch.3 p.12")' },
      },
      required: ['title', 'keyPoints'],
    },
  },
  {
    name: 'renderQuiz',
    description: 'Render an interactive quiz inline for knowledge checks. Use after teaching a concept to verify understanding.',
    input_schema: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'The question text' },
              options: { type: 'array', items: { type: 'string' }, description: '2-4 answer options' },
              correctIndex: { type: 'number', description: 'Index of the correct option (0-based)' },
              explanation: { type: 'string', description: 'Explanation shown after answering' },
            },
            required: ['question', 'options', 'correctIndex', 'explanation'],
          },
          description: '1-5 quiz questions',
        },
      },
      required: ['questions'],
    },
  },
]
