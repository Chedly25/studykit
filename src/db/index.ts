import Dexie, { type Table } from 'dexie'
import type {
  ExamProfile,
  Subject,
  Topic,
  Subtopic,
  StudySession,
  QuestionResult,
  Document,
  DocumentChunk,
  FlashcardDeck,
  Flashcard,
  Assignment,
  Conversation,
  ChatMessage,
  UserPreferences,
  DailyStudyLog,
  TutorPreferences,
  SessionInsight,
  StudyPlan,
  StudyPlanDay,
  StudentModel,
  ConversationSummary,
  Notification,
  NotificationPreferences,
  ExamFormat,
  MockExam,
} from './schema'

export class StudiesKitDB extends Dexie {
  examProfiles!: Table<ExamProfile>
  subjects!: Table<Subject>
  topics!: Table<Topic>
  subtopics!: Table<Subtopic>
  studySessions!: Table<StudySession>
  questionResults!: Table<QuestionResult>
  documents!: Table<Document>
  documentChunks!: Table<DocumentChunk>
  flashcardDecks!: Table<FlashcardDeck>
  flashcards!: Table<Flashcard>
  assignments!: Table<Assignment>
  conversations!: Table<Conversation>
  chatMessages!: Table<ChatMessage>
  userPreferences!: Table<UserPreferences>
  dailyStudyLogs!: Table<DailyStudyLog>
  tutorPreferences!: Table<TutorPreferences>
  sessionInsights!: Table<SessionInsight>
  studyPlans!: Table<StudyPlan>
  studyPlanDays!: Table<StudyPlanDay>
  studentModels!: Table<StudentModel>
  conversationSummaries!: Table<ConversationSummary>
  notifications!: Table<Notification>
  notificationPreferences!: Table<NotificationPreferences>
  examFormats!: Table<ExamFormat>
  mockExams!: Table<MockExam>

  constructor() {
    super('studieskit')

    this.version(1).stores({
      examProfiles: 'id, examType, isActive',
      subjects: 'id, examProfileId, order',
      topics: 'id, subjectId, examProfileId, mastery, nextReviewDate',
      subtopics: 'id, topicId, examProfileId',
      studySessions: 'id, examProfileId, subjectId, startTime, type',
      questionResults: 'id, examProfileId, topicId, timestamp',
      documents: 'id, examProfileId',
      documentChunks: 'id, documentId, examProfileId, topicId',
      flashcardDecks: 'id, examProfileId, topicId',
      flashcards: 'id, deckId, topicId, nextReviewDate',
      assignments: 'id, examProfileId, dueDate, status',
      conversations: 'id, examProfileId, updatedAt',
      chatMessages: 'id, conversationId, timestamp',
      userPreferences: 'id',
      dailyStudyLogs: 'id, examProfileId, date',
    })

    this.version(2).stores({
      examProfiles: 'id, examType, isActive, userId',
    }).upgrade(tx =>
      tx.table('examProfiles').toCollection().modify(profile => {
        if (!profile.userId) profile.userId = 'local'
      })
    )

    this.version(3).stores({
      documents: 'id, examProfileId, sourceType',
      documentChunks: 'id, documentId, examProfileId, topicId',
    }).upgrade(tx => {
      tx.table('documents').toCollection().modify(doc => {
        if (doc.chunkCount === undefined) doc.chunkCount = 0
        if (doc.wordCount === undefined) doc.wordCount = 0
      })
      tx.table('documentChunks').toCollection().modify(chunk => {
        if (chunk.keywords === undefined) chunk.keywords = ''
      })
    })

    this.version(4).stores({
      tutorPreferences: 'id, examProfileId',
      sessionInsights: 'id, examProfileId, conversationId, timestamp',
      studyPlans: 'id, examProfileId, isActive',
      studyPlanDays: 'id, planId, examProfileId, date',
    }).upgrade(tx => {
      tx.table('questionResults').toCollection().modify(qr => {
        if (qr.errorType === undefined) qr.errorType = null
      })
    })

    this.version(5).stores({}).upgrade(tx => {
      tx.table('userPreferences').toCollection().modify(pref => {
        if (pref.language === undefined) pref.language = 'en'
      })
    })

    this.version(6).stores({
      studentModels: 'id, examProfileId',
      conversationSummaries: 'id, examProfileId, conversationId, sessionDate',
    })

    this.version(7).stores({}).upgrade(tx => {
      tx.table('topics').toCollection().modify(topic => {
        if (topic.prerequisiteTopicIds === undefined) topic.prerequisiteTopicIds = []
      })
    })

    this.version(8).stores({
      notifications: 'id, examProfileId, type, isRead, createdAt',
      notificationPreferences: 'id, examProfileId',
      examFormats: 'id, examProfileId',
    })

    this.version(9).stores({
      mockExams: 'id, examProfileId, status, startTime',
    })
  }
}

export const db = new StudiesKitDB()
