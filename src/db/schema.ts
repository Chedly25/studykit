/**
 * Database schema — TypeScript interfaces for all IndexedDB tables.
 */

// ─── Exam Profile ───────────────────────────────────────────────
export type ExamType = 'university-course' | 'professional-exam' | 'graduate-research'
  | 'language-learning' | 'custom'

export type ProfileMode = 'study' | 'research'

export interface ExamProfile {
  id: string
  name: string
  examType: ExamType
  examDate: string // YYYY-MM-DD (empty string '' for no deadline)
  isActive: boolean
  passingThreshold: number // 0-100
  weeklyTargetHours: number
  createdAt: string
  userId?: string
  examIntelligence?: string // JSON exam research data
  profileMode?: ProfileMode
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

export type TopicStatus = 'exploring' | 'active' | 'blocked' | 'resolved'

export interface Chapter {
  id: string
  subjectId: string
  examProfileId: string
  name: string
  order: number
}

export interface Topic {
  id: string
  subjectId: string
  examProfileId: string
  chapterId?: string
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
  // Research mode status
  status?: TopicStatus
}

export interface Subtopic {
  id: string
  topicId: string
  examProfileId: string
  name: string
}

// ─── Study Sessions ─────────────────────────────────────────────
export type SessionType = 'pomodoro' | 'free' | 'socratic' | 'practice-exam' | 'review' | 'writing'

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

export type DocumentCategory = 'course' | 'exam' | 'other'

export interface Document {
  id: string
  examProfileId: string
  title: string
  sourceType: DocumentSourceType
  category?: DocumentCategory
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

export interface DocumentFile {
  id: string
  documentId: string
  examProfileId: string
  file: Blob
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

// ─── Concept Cards ─────────────────────────────────────────────

export interface ConceptCard {
  id: string
  examProfileId: string
  topicId: string
  title: string
  keyPoints: string       // JSON string[]
  example: string
  sourceChunkIds: string  // JSON string[]
  sourceReference: string
  relatedCardIds: string  // JSON string[]
  mastery: number         // 0-1
  createdAt: string
  updatedAt: string
}

export interface ConceptCardConnection {
  id: string
  fromCardId: string
  toCardId: string
  examProfileId: string
  label: string           // e.g. "requires", "extends", "contrasts"
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
export type NotificationType = 'study-reminder' | 'review-due' | 'streak-warning' | 'plan-suggestion' | 'milestone' | 'mastery-drop' | 'weak-topic' | 'performance-alert'

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

// ─── Practice Exam Sessions ────────────────────────────────────
export type PracticeExamPhase = 'generating' | 'ready' | 'in-progress' | 'grading' | 'graded'

export interface PracticeExamSession {
  id: string
  examProfileId: string
  phase: PracticeExamPhase
  questionCount: number
  focusSubject?: string
  examSection?: string
  sourcesEnabled: boolean
  timeLimitSeconds?: number
  startedAt?: string
  completedAt?: string
  totalScore?: number
  maxScore?: number
  overallFeedback?: string
  createdAt: string
}

export interface GeneratedQuestion {
  id: string
  sessionId: string
  examProfileId: string
  questionIndex: number
  text: string
  format: QuestionFormat
  options?: string
  correctAnswer: string
  correctOptionIndex?: number
  explanation: string
  difficulty: number
  topicName: string
  points: number
  scenarioText?: string
  subQuestions?: string
  sourceReference?: string
  userAnswer?: string
  isAnswered: boolean
  isCorrect?: boolean
  earnedPoints?: number
  feedback?: string
}

// ─── Chunk Embeddings ───────────────────────────────────────────
export interface ChunkEmbedding {
  id: string
  chunkId: string
  documentId: string
  examProfileId: string
  embedding: string // base64-encoded Float32Array (768-dim)
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

// ─── Research Mode ─────────────────────────────────────────────

export type MilestoneStatus = 'pending' | 'in-progress' | 'done'

export interface Milestone {
  id: string
  examProfileId: string
  title: string
  targetDate?: string
  description: string
  status: MilestoneStatus
  order: number
  createdAt: string
}

export interface ResearchNote {
  id: string
  examProfileId: string
  title: string
  content: string
  linkedNoteIds: string   // JSON string[]
  linkedTopicIds: string  // JSON string[]
  linkedDocumentIds: string // JSON string[]
  tags: string            // JSON string[]
  createdAt: string
  updatedAt: string
}

export type AnnotationType = 'key-finding' | 'methodology' | 'relates-to-my-work' | 'question' | 'note'

export interface Annotation {
  id: string
  documentId: string
  chunkId: string
  examProfileId: string
  type: AnnotationType
  content: string
  createdAt: string
}

export type HabitFrequency = 'daily' | 'weekly'

export interface HabitGoal {
  id: string
  examProfileId: string
  title: string
  targetValue: number
  unit: string
  frequency: HabitFrequency
  currentStreak: number
  createdAt: string
}

export interface HabitLog {
  id: string
  goalId: string
  examProfileId: string
  date: string
  value: number
}

export interface WritingSession {
  id: string
  examProfileId: string
  noteId?: string
  wordCountStart: number
  wordCountEnd: number
  durationSeconds: number
  createdAt: string
}

export type AdvisorMeetingStatus = 'upcoming' | 'completed'

export interface AdvisorMeeting {
  id: string
  examProfileId: string
  date: string
  summary: string
  actionItems: string  // JSON string[]
  notes: string
  status: AdvisorMeetingStatus
}

// ─── Article Review ────────────────────────────────────────────
export type ReviewProjectStatus = 'setup' | 'processing' | 'reviewing' | 'completed'
export type ArticleDecision = 'pending' | 'shortlisted' | 'maybe' | 'rejected'
export type ArticleProcessingStatus = 'queued' | 'ingesting' | 'analyzing' | 'researching' | 'done' | 'failed'

export interface ReviewProject {
  id: string
  examProfileId: string
  name: string
  description: string
  deadline: string
  targetShortlistCount: number
  status: ReviewProjectStatus
  synthesisResult?: string // JSON: theme clusters, comparative ranking
  createdAt: string
  updatedAt: string
}

export interface ReviewArticle {
  id: string
  projectId: string
  examProfileId: string
  documentId: string

  processingStatus: ArticleProcessingStatus
  processingError?: string

  aiAnalysis?: string // JSON: { summary, keyFindings[], methodology, themes[], notableQuotes[] }
  noveltyScore?: number
  relevanceScore?: number
  qualityScore?: number

  researchContext?: string // JSON: { authorCredentials, citationInfo, relatedWork[] }

  userNotes?: string
  userScore?: number
  decision: ArticleDecision

  compositeScore?: number
  createdAt: string
  updatedAt: string
}

// ─── Mastery Snapshots ─────────────────────────────────────────
export interface MasterySnapshot {
  id: string        // topicId:YYYY-MM-DD
  topicId: string
  examProfileId: string
  date: string
  mastery: number
}

// ─── PDF Highlights ────────────────────────────────────────────
export interface PdfHighlight {
  id: string
  documentId: string
  examProfileId: string
  pageNumber: number
  text: string
  rects: string       // JSON: Array<{x, y, width, height}> in PDF coords
  color: string       // hex color
  note?: string
  flashcardId?: string
  createdAt: string
}

// ─── Achievements ─────────────────────────────────────────────
export interface AchievementRecord {
  id: string
  examProfileId: string
  achievementId: string
  unlockedAt: string
}

// ─── Background Jobs ──────────────────────────────────────────
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
// ─── Exercise Bank ──────────────────────────────────────────────

export type ExerciseStatus = 'not_attempted' | 'attempted' | 'completed'

export interface ExamSource {
  id: string
  examProfileId: string
  documentId: string
  name: string
  year?: number
  institution?: string
  totalExercises: number
  parsedAt: string
}

export interface Exercise {
  id: string
  examSourceId: string
  examProfileId: string
  exerciseNumber: number
  text: string
  solutionText?: string
  difficulty: number // 1-5
  points?: number
  topicIds: string // JSON string[]
  status: ExerciseStatus
  lastAttemptScore?: number
  attemptCount: number
  createdAt: string
}

export interface ExerciseAttempt {
  id: string
  exerciseId: string
  examProfileId: string
  score: number // 0-1
  feedback?: string
  createdAt: string
}

// ─── Background Jobs ────────────────────────────────────────────

export type JobType =
  | 'source-processing'
  | 'article-review-batch'
  | 'article-synthesis'
  | 'practice-exam-generation'
  | 'practice-exam-grading'
  | 'study-plan'
  | 'session-insight'
  | 'exam-research'
  | 'exam-exercise-processing'

export interface BackgroundJob {
  id: string
  examProfileId: string
  type: JobType
  status: JobStatus

  config: string             // JSON — workflow config to reconstruct on resume
  completedStepIds: string   // JSON string[] — step IDs already done
  stepResults: string        // JSON Record<string, StepResult> — checkpoint data

  totalSteps: number
  completedStepCount: number
  currentStepName: string

  // Batch support (article review)
  batchItemIds?: string      // JSON string[]
  batchCompletedIds?: string // JSON string[]
  batchFailedIds?: string    // JSON string[]
  batchConcurrency?: number

  error?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
}
