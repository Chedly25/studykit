/**
 * Registry of all exam seed data.
 */
import type { ExamType } from '../db/schema'
import type { SeedSubject } from '../db/seed/barExam'
import { barExamSeed } from '../db/seed/barExam'
import { usmleStep1Seed } from '../db/seed/usmleStep1'
import { cfaLevel1Seed } from '../db/seed/cfaLevel1'
import { customExamSeed } from '../db/seed/custom'

export interface ExamBlueprint {
  examType: ExamType
  label: string
  description: string
  defaultPassingThreshold: number
  subjects: SeedSubject[]
}

export const examBlueprints: Record<ExamType, ExamBlueprint> = {
  bar: {
    examType: 'bar',
    label: 'Bar Exam (MBE)',
    description: 'Multistate Bar Examination — 7 subjects based on NCBE blueprint',
    defaultPassingThreshold: 70,
    subjects: barExamSeed.subjects,
  },
  'usmle-step1': {
    examType: 'usmle-step1',
    label: 'USMLE Step 1',
    description: 'United States Medical Licensing Examination — organ systems & disciplines',
    defaultPassingThreshold: 60,
    subjects: usmleStep1Seed.subjects,
  },
  'cfa-level1': {
    examType: 'cfa-level1',
    label: 'CFA Level I',
    description: 'Chartered Financial Analyst Level I — 10 topic areas',
    defaultPassingThreshold: 70,
    subjects: cfaLevel1Seed.subjects,
  },
  custom: {
    examType: 'custom',
    label: 'Custom Exam',
    description: 'Create your own exam structure with custom subjects and topics',
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
