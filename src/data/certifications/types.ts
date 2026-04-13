/**
 * Certification catalog types.
 * Each certification is a pure data entry — adding a new cert requires zero code changes.
 */
import type { QuestionFormat } from '../../db/schema'

export interface ExtractedTopic {
  name: string
}

export interface ExtractedChapter {
  name: string
  topics: ExtractedTopic[]
}

export interface ExtractedSubject {
  name: string
  weight: number
  topics: ExtractedTopic[]
  chapters?: ExtractedChapter[]
}

export interface CertificationExamFormat {
  formatName: string
  description: string
  timeAllocation: number
  pointWeight: number
  questionCount: number
  questionFormat?: QuestionFormat
  sectionType?: 'written' | 'oral' | 'practical'
  canGoBack?: boolean
  negativeMarking?: boolean
  negativeMarkingPenalty?: number
  shuffleQuestions?: boolean
  passingScore?: number
  instructions?: string
}

export interface CertificationEntry {
  id: string
  vendor: string
  certName: string
  certCode: string
  aliases: RegExp[]
  retirementDate?: string
  replacedBy?: string

  passingThresholdPercent: number
  totalDurationMinutes: number
  questionCountTotal: number
  scoringScale: { passing: number; max: number }
  questionTypes: string
  performanceBased: boolean
  formats: CertificationExamFormat[]

  subjects: ExtractedSubject[]

  examIntelligence: {
    overview: string
    totalDuration: number
    passingScore: number
    tips: string[]
  }

  questionStyle: string
}
