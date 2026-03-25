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
  MasterySnapshot,
  PdfHighlight,
  AchievementRecord,
  TopicEmbedding,
  Misconception,
  TutoringEpisode,
  AgentRun,
  AgentInsight,
  ContentEffectiveness,
  StrategyEffectiveness,
  SyncQueueEntry,
  SyncMeta,
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
  masterySnapshots!: Table<MasterySnapshot>
  pdfHighlights!: Table<PdfHighlight>
  achievements!: Table<AchievementRecord>
  topicEmbeddings!: Table<TopicEmbedding>
  misconceptions!: Table<Misconception>
  tutoringEpisodes!: Table<TutoringEpisode>
  agentRuns!: Table<AgentRun>
  agentInsights!: Table<AgentInsight>
  contentEffectiveness!: Table<ContentEffectiveness>
  strategyEffectiveness!: Table<StrategyEffectiveness>
  macroRoadmaps!: Table<import('./schema').MacroRoadmap>
  _syncQueue!: Table<SyncQueueEntry>
  _syncMeta!: Table<SyncMeta>

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

    this.version(18).stores({
      masterySnapshots: 'id, topicId, examProfileId, date',
      pdfHighlights: 'id, documentId, examProfileId, [documentId+pageNumber]',
    })

    this.version(19).stores({
      achievements: 'id, examProfileId, achievementId, [examProfileId+achievementId]',
    })

    this.version(20).stores({})

    this.version(21).stores({
      topicEmbeddings: 'id, topicId, examProfileId',
    })

    this.version(22).stores({
      exercises: 'id, examSourceId, examProfileId, nextReviewDate, [examProfileId+status]',
      misconceptions: 'id, examProfileId, topicId, [examProfileId+topicId]',
    }).upgrade(tx => {
      // Add SRS defaults to existing exercises
      // Already-attempted exercises get a future review date to avoid flooding the queue
      const today = new Date().toISOString().slice(0, 10)
      const threeDaysOut = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
      const weekOut = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      return tx.table('exercises').toCollection().modify(exercise => {
        if (exercise.easeFactor === undefined) exercise.easeFactor = 2.5
        if (exercise.interval === undefined) exercise.interval = 0
        if (exercise.repetitions === undefined) exercise.repetitions = 0
        if (exercise.nextReviewDate === undefined) {
          // Completed exercises review in a week, attempted in 3 days, new ones today
          exercise.nextReviewDate = exercise.status === 'completed' ? weekOut
            : exercise.status === 'attempted' ? threeDaysOut
            : today
        }
      })
    })

    this.version(23).stores({
      tutoringEpisodes: 'id, userId, [userId+topicId], [userId+type]',
      agentRuns: 'id, [examProfileId+agentId], createdAt',
      agentInsights: 'id, [examProfileId+agentId]',
      contentEffectiveness: 'id, contentId, [examProfileId+contentType], generationStrategy',
      strategyEffectiveness: 'id, contentType',
    })

    this.version(24).stores({}) // contextPrefix added to DocumentChunk (optional field, no index change)

    this.version(25).stores({
      macroRoadmaps: 'id, examProfileId',
    })

    this.version(26).stores({
      conceptCards: 'id, examProfileId, topicId, [examProfileId+topicId], nextReviewDate',
    }).upgrade(tx => {
      const today = new Date().toISOString().slice(0, 10)
      return tx.table('conceptCards').toCollection().modify(card => {
        if (card.easeFactor === undefined) card.easeFactor = 2.5
        if (card.interval === undefined) card.interval = 0
        if (card.repetitions === undefined) card.repetitions = 0
        if (card.nextReviewDate === undefined) card.nextReviewDate = today
      })
    })

    this.version(27).stores({
      generatedQuestions: 'id, sessionId, examProfileId, questionIndex, examSectionId, [sessionId+sectionIndex]',
      examFormats: 'id, examProfileId, [examProfileId+order]',
    }).upgrade(tx => {
      return tx.table('examFormats').toCollection().modify(fmt => {
        if (fmt.sectionType === undefined) fmt.sectionType = 'written'
        if (fmt.order === undefined) fmt.order = 0
      })
    })

    this.version(28).stores({
      _syncQueue: '++id, table, timestamp',
      _syncMeta: 'id',
    })

    // v29: Document exam fields on PracticeExamSession (optional, no index changes)
    this.version(29).stores({})

    // v30: Note de synthèse fields on PracticeExamSession (optional, no index changes)
    this.version(30).stores({})

    // v31: Cas pratique + Grand Oral exam modes (no schema changes, just new ExamMode values)
    this.version(31).stores({})
  }
}

export const db = new StudiesKitDB()

// Initialize incremental sync change tracking
import { initSyncTracking } from './syncTracking'
initSyncTracking()
