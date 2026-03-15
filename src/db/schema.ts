/**
 * Database schema — TypeScript interfaces for all IndexedDB tables.
 */

// ─── Exam Profile ───────────────────────────────────────────────
export type ExamType = 'bar' | 'usmle-step1' | 'cfa-level1' | 'custom'

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
}

// ─── Documents ──────────────────────────────────────────────────
export type DocumentSourceType = 'pdf' | 'text' | 'image' | 'paste'

export interface Document {
  id: string
  examProfileId: string
  title: string
  sourceType: DocumentSourceType
  originalContent: string
  createdAt: string
}

export interface DocumentChunk {
  id: string
  documentId: string
  examProfileId: string
  content: string
  topicId?: string
  chunkIndex: number
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

// ─── Preferences ────────────────────────────────────────────────
export interface UserPreferences {
  id: string // always 'default'
  theme: 'light' | 'dark'
  pomodoroWorkDuration: number
  pomodoroShortBreak: number
  pomodoroLongBreak: number
  pomodoroLongBreakInterval: number
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
