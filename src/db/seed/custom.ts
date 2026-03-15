/**
 * Custom exam template — empty structure for user-defined exams.
 */
import type { ExamType } from '../schema'

export interface SeedTopic {
  name: string
  subtopics?: string[]
}

export interface SeedSubject {
  name: string
  weight: number // percentage of exam
  color: string
  topics: SeedTopic[]
}

export const customExamSeed: { examType: ExamType; subjects: SeedSubject[] } = {
  examType: 'custom',
  subjects: [],
}
