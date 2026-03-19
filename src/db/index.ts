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
  PracticeExamSession,
  GeneratedQuestion,
  ChunkEmbedding,
  Milestone,
  ResearchNote,
  Annotation,
  HabitGoal,
  HabitLog,
  WritingSession,
  AdvisorMeeting,
  ReviewProject,
  ReviewArticle,
  BackgroundJob,
  ConceptCard,
  ConceptCardConnection,
  Chapter,
  ExamSource,
  Exercise,
  ExerciseAttempt,
  DocumentFile,
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
  practiceExamSessions!: Table<PracticeExamSession>
  generatedQuestions!: Table<GeneratedQuestion>
  chunkEmbeddings!: Table<ChunkEmbedding>
  milestones!: Table<Milestone>
  researchNotes!: Table<ResearchNote>
  annotations!: Table<Annotation>
  habitGoals!: Table<HabitGoal>
  habitLogs!: Table<HabitLog>
  writingSessions!: Table<WritingSession>
  advisorMeetings!: Table<AdvisorMeeting>
  reviewProjects!: Table<ReviewProject>
  reviewArticles!: Table<ReviewArticle>
  backgroundJobs!: Table<BackgroundJob>
  conceptCards!: Table<ConceptCard>
  conceptCardConnections!: Table<ConceptCardConnection>
  chapters!: Table<Chapter>
  examSources!: Table<ExamSource>
  exercises!: Table<Exercise>
  exerciseAttempts!: Table<ExerciseAttempt>
  documentFiles!: Table<DocumentFile>

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

    this.version(10).stores({
      practiceExamSessions: 'id, examProfileId, phase, createdAt',
      generatedQuestions: 'id, sessionId, examProfileId, questionIndex',
    })

    this.version(11).stores({
      chunkEmbeddings: 'id, chunkId, documentId, examProfileId',
    })

    this.version(12).stores({
      milestones: 'id, examProfileId, status, order',
      researchNotes: 'id, examProfileId, updatedAt',
      annotations: 'id, documentId, chunkId, examProfileId, [documentId+examProfileId]',
      habitGoals: 'id, examProfileId',
      habitLogs: 'id, goalId, examProfileId, date',
      writingSessions: 'id, examProfileId, createdAt',
      advisorMeetings: 'id, examProfileId, date, status',
    }).upgrade(tx => {
      tx.table('examProfiles').toCollection().modify(profile => {
        if (profile.profileMode === undefined) profile.profileMode = 'study'
      })
    })

    this.version(13).stores({
      reviewProjects: 'id, examProfileId, status, createdAt',
      reviewArticles: 'id, projectId, examProfileId, documentId, decision, processingStatus, compositeScore, [projectId+decision], [projectId+processingStatus]',
    })

    this.version(14).stores({
      backgroundJobs: 'id, examProfileId, type, status, createdAt, [examProfileId+status]',
    })

    this.version(15).stores({
      conceptCards: 'id, examProfileId, topicId, [examProfileId+topicId]',
      conceptCardConnections: 'id, fromCardId, examProfileId',
    })

    this.version(16).stores({
      chapters: 'id, subjectId, examProfileId',
      examSources: 'id, examProfileId, documentId',
      exercises: 'id, examSourceId, examProfileId, status, difficulty',
      exerciseAttempts: 'id, exerciseId, examProfileId',
    }).upgrade(async tx => {
      // Set default category on existing documents
      await tx.table('documents').toCollection().modify(doc => {
        if (doc.category === undefined) doc.category = 'course'
      })

      // Create a default chapter for each subject and assign existing topics
      const subjects = await tx.table('subjects').toArray()
      for (const subject of subjects) {
        const chapterId = crypto.randomUUID()
        await tx.table('chapters').add({
          id: chapterId,
          subjectId: subject.id,
          examProfileId: subject.examProfileId,
          name: 'General',
          order: 0,
        })
        // Assign all topics of this subject to the default chapter
        await tx.table('topics')
          .where('subjectId').equals(subject.id)
          .modify({ chapterId })
      }
    })

    this.version(17).stores({
      documentFiles: 'id, documentId, examProfileId',
    })
  }
}

export const db = new StudiesKitDB()
