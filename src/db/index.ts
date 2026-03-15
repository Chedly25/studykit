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
  }
}

export const db = new StudiesKitDB()
