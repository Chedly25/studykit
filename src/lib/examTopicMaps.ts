/**
 * Registry of all exam/study goal seed data.
 */
import type { ExamType } from '../db/schema'
import type { SeedSubject } from '../db/seed/custom'
import { customExamSeed } from '../db/seed/custom'

export interface ExamBlueprint {
  examType: ExamType
  label: string
  description: string
  defaultPassingThreshold: number
  subjects: SeedSubject[]
}

export const examBlueprints: Record<ExamType, ExamBlueprint> = {
  'university-course': {
    examType: 'university-course',
    label: 'University Course',
    description: 'Any university or college course — add your own subjects and topics',
    defaultPassingThreshold: 70,
    subjects: customExamSeed.subjects,
  },
  'professional-exam': {
    examType: 'professional-exam',
    label: 'Professional Exam',
    description: 'Bar exam, medical boards, engineering PE, CFA, etc.',
    defaultPassingThreshold: 70,
    subjects: customExamSeed.subjects,
  },
  'graduate-research': {
    examType: 'graduate-research',
    label: 'Graduate & PhD',
    description: 'Thesis, qualifying exams, dissertation research',
    defaultPassingThreshold: 70,
    subjects: customExamSeed.subjects,
  },
  'language-learning': {
    examType: 'language-learning',
    label: 'Language Learning',
    description: 'Language proficiency exams and learning goals',
    defaultPassingThreshold: 80,
    subjects: customExamSeed.subjects,
  },
  custom: {
    examType: 'custom',
    label: 'Custom',
    description: 'Create your own structure with custom subjects and topics',
    defaultPassingThreshold: 70,
    subjects: customExamSeed.subjects,
  },
}

export function getExamBlueprint(examType: ExamType): ExamBlueprint {
  return examBlueprints[examType]
}

export function getAllExamTypes(): ExamType[] {
  return Object.keys(examBlueprints) as ExamType[]
}
