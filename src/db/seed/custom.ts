/**
 * Custom exam template — empty structure for user-defined exams.
 */
import type { ExamType } from '../schema'
import type { SeedSubject } from './barExam'

export const customExamSeed: { examType: ExamType; subjects: SeedSubject[] } = {
  examType: 'custom',
  subjects: [],
}
