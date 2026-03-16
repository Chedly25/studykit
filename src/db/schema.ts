/**
 * Database schema — TypeScript interfaces for all IndexedDB tables.
 */

// ─── Exam Profile ───────────────────────────────────────────────
export type ExamType = 'university-course' | 'professional-exam' | 'graduate-research'
  | 'language-learning' | 'custom'

export interface ExamProfile {
  id: string
  name: string
  examType: ExamType
  examDate: string // YYYY-MM-DD
  isActive: boolean
  passingThreshold: number // 0-100
  weeklyTargetHours: number
  createdAt: string
  userId?: string
}

// ─── Knowledge Graph ────────────────────────────────────────────
export interface Subject {
  id: string
  examProfileId: string
  name: string
  weight: number // percentage of exam (0-100)
  mastery: number // computed 0-1
  color: string
  order: number
}

export interface Topic {
  id: string
  subjectId: string
  examProfileId: string
  name: string
  mastery: number // computed 0-1
  confidence: number // self-reported 0-1
  questionsAttempted: number
  questionsCorrect: number
  // SM-2 topic-level SRS
  easeFactor: number
  interval: number
  repetitions: number
  nextReviewDate: string
  // Dependencies (Phase 3)
  prerequisiteTopicIds?: string[] // IDs of prerequisite topics
}

export interface Subtopic {
  id: string
  topicId: string
  examProfileId: string
  name: string
}

// ─── Study Sessions ─────────────────────────────────────────────
export type SessionType = 'pomodoro' | 'free' | 'socratic' | 'practice-exam' | 'review'

export interface StudySession {
  id: string
  examProfileId: string
  subjectId?: string
  topicId?: string
  startTime: string
  endTime?: string
  durationSeconds: number
  type: SessionType
}

// ─── Questions & Results ────────────────────────────────────────
export type QuestionFormat = 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'vignette'

export interface QuestionResult {
  id: string
  examProfileId: string
  topicId: string
  question: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  difficulty: number // 1-5
  confidence: number // 0-1
  format: QuestionFormat
  explanation: string
  timestamp: string
  errorType?: ErrorType | null
}

// ─── Documents ──────────────────────────────────────────────────
export type DocumentSourceType = 'pdf' | 'text' | 'image' | 'paste' | 'url'

export interface Document {
  id: string
  examProfileId: string
  title: string
  sourceType: DocumentSourceType
  originalContent: string
  summary?: string
  chunkCount: number
  wordCount: number
  sourceUrl?: string
  createdAt: string
}

export interface DocumentChunk {
  id: string
  documentId: string
  examProfileId: string
  content: string
  topicId?: string
  chunkIndex: number
  keywords: string // comma-separated lowercase terms for search
}

// ─── Flashcards ─────────────────────────────────────────────────
export type FlashcardSource = 'manual' | 'ai-generated' | 'imported'

export interface FlashcardDeck {
  id: string
  examProfileId?: string
  topicId?: string
  name: string
  createdAt: string
}

export interface Flashcard {
  id: string
  deckId: string
  topicId?: string
  front: string
  back: string
  source: FlashcardSource
  // SM-2 fields
  easeFactor: number
  interval: number
  repetitions: number
  nextReviewDate: string
  lastRating: number
}

// ─── Assignments ────────────────────────────────────────────────
export type AssignmentPriority = 'low' | 'medium' | 'high'
export type AssignmentStatus = 'todo' | 'in-progress' | 'done'

export interface Assignment {
  id: string
  examProfileId?: string
  title: string
  description: string
  dueDate: string
  priority: AssignmentPriority
  status: AssignmentStatus
  createdAt: string
}

// ─── Conversations ──────────────────────────────────────────────
export interface Conversation {
  id: string
  examProfileId: string
  title: string
  createdAt: string
  updatedAt: string
}

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  conversationId: string
  role: ChatRole
  content: string
  toolCalls?: string // JSON-serialized tool calls
  timestamp: string
}

// ─── Tutor Preferences (per-profile) ────────────────────────────
export type TeachingStyle = 'concise' | 'detailed'
export type ExplanationApproach = 'analogies-first' | 'definitions-first' | 'examples-first' | 'step-by-step'
export type FeedbackTone = 'encouraging' | 'direct'
export type LanguageLevel = 'beginner-friendly' | 'expert'

export interface TutorPreferences {
  id: string            // same as examProfileId (1:1)
  examProfileId: string
  teachingStyle: TeachingStyle
  explanationApproach: ExplanationApproach
  feedbackTone: FeedbackTone
  languageLevel: LanguageLevel
}

// ─── Session Insights ───────────────────────────────────────────
export interface SessionInsight {
  id: string
  examProfileId: string
  conversationId: string
  conceptsDiscussed: string   // JSON string[]
  misconceptions: string      // JSON string[]
  breakthroughs: string       // JSON string[]
  openQuestions: string       // JSON string[]
  summary: string
  timestamp: string
}

// ─── Study Plans ────────────────────────────────────────────────
export type StudyActivityType = 'read' | 'flashcards' | 'practice' | 'socratic' | 'explain-back' | 'review'

export interface StudyPlan {
  id: string
  examProfileId: string
  generatedAt: string
  isActive: boolean
  totalDays: number
}

export interface StudyPlanDay {
  id: string              // planId:YYYY-MM-DD
  planId: string
  examProfileId: string
  date: string
  activities: string      // JSON array of { topicName, activityType, durationMinutes, completed }
  isCompleted: boolean
}

// ─── Error Types ────────────────────────────────────────────────
export type ErrorType = 'recall' | 'conceptual' | 'application' | 'distractor'

// ─── Preferences ────────────────────────────────────────────────
export interface UserPreferences {
  id: string // always 'default'
  theme: 'light' | 'dark'
  language?: 'en' | 'fr'
  pomodoroWorkDuration: number
  pomodoroShortBreak: number
  pomodoroLongBreak: number
  pomodoroLongBreakInterval: number
}

// ─── Student Model (persistent AI-observed traits) ──────────────
export interface StudentModel {
  id: string            // same as examProfileId (1:1)
  examProfileId: string
  learningStyle: string        // JSON object
  commonMistakes: string       // JSON string[]
  personalityNotes: string     // JSON string[]
  preferredExplanations: string // JSON string[]
  motivationTriggers: string   // JSON string[]
  updatedAt: string
}

// ─── Conversation Summaries ─────────────────────────────────────
export interface ConversationSummary {
  id: string
  examProfileId: string
  conversationId: string
  topicsCovered: string       // JSON string[]
  keyOutcomes: string         // JSON string[]
  masteryChanges: string      // JSON object
  sessionDate: string
  durationEstimate: number    // minutes
}

// ─── Notifications ──────────────────────────────────────────────
export type NotificationType = 'study-reminder' | 'review-due' | 'streak-warning' | 'plan-suggestion' | 'milestone'

export interface Notification {
  id: string
  examProfileId: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  createdAt: string
  actionUrl?: string
}

export interface NotificationPreferences {
  id: string // same as examProfileId (1:1)
  examProfileId: string
  studyReminders: boolean
  reviewDue: boolean
  streakWarnings: boolean
  planSuggestions: boolean
  milestones: boolean
}

// ─── Exam Formats ───────────────────────────────────────────────
export interface ExamFormat {
  id: string
  examProfileId: string
  formatName: string
  description: string
  timeAllocation: number    // minutes
  pointWeight: number       // percentage
  questionCount?: number
  samplePrompt?: string
}

// ─── Mock Exams ─────────────────────────────────────────────────
export type MockExamStatus = 'in-progress' | 'completed' | 'graded'

export interface MockExam {
  id: string
  examProfileId: string
  startTime: string
  endTime?: string
  timeLimitMinutes: number
  sections: string          // JSON array of { formatId, questions, answers }
  totalScore?: number
  maxScore?: number
  status: MockExamStatus
  feedback?: string         // JSON AI feedback
}

// ─── Daily Study Logs ───────────────────────────────────────────
export interface SubjectBreakdown {
  subjectId: string
  seconds: number
}

export interface DailyStudyLog {
  id: string // examProfileId:YYYY-MM-DD
  examProfileId: string
  date: string
  totalSeconds: number
  subjectBreakdown: SubjectBreakdown[]
  questionsAnswered: number
  questionsCorrect: number
}
