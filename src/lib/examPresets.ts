/**
 * Pre-built exam format definitions for popular exams.
 * Students can select a preset to auto-populate their exam sections.
 */
import type { QuestionFormat } from '../db/schema'

export interface ExamPresetSection {
  formatName: string
  description: string
  timeAllocation: number
  pointWeight: number
  questionCount: number
  questionFormat?: QuestionFormat
  sectionType?: 'written' | 'oral' | 'practical'
  negativeMarking?: boolean
  negativeMarkingPenalty?: number
  instructions?: string
  canGoBack?: boolean
  shuffleQuestions?: boolean
}

export interface ExamPreset {
  id: string
  name: string
  category: 'engineering' | 'medical' | 'law' | 'business' | 'language' | 'technology' | 'general'
  sections: ExamPresetSection[]
}

export const EXAM_PRESETS: ExamPreset[] = [
  // ─── Engineering / CPGE ───
  {
    id: 'cpge-maths',
    name: 'Concours Mines-Ponts — Mathématiques',
    category: 'engineering',
    sections: [
      { formatName: 'Problème I', description: 'Multi-part problem, algebra + analysis', timeAllocation: 120, pointWeight: 50, questionCount: 8, questionFormat: 'short-answer', instructions: 'Toutes les réponses doivent être justifiées. Calculatrice interdite.' },
      { formatName: 'Problème II', description: 'Multi-part problem, geometry + probability', timeAllocation: 120, pointWeight: 50, questionCount: 8, questionFormat: 'short-answer', instructions: 'Toutes les réponses doivent être justifiées. Calculatrice interdite.' },
    ],
  },
  {
    id: 'cpge-physique',
    name: 'Concours X — Physique',
    category: 'engineering',
    sections: [
      { formatName: 'Problème', description: 'Long multi-part physics problem with progressive difficulty', timeAllocation: 240, pointWeight: 100, questionCount: 15, questionFormat: 'short-answer', instructions: 'Calculatrice autorisée. Justifier toutes les étapes.' },
    ],
  },
  {
    id: 'cpge-si',
    name: 'Concours CCP — Sciences Industrielles',
    category: 'engineering',
    sections: [
      { formatName: 'Étude d\'un système', description: 'Analysis of an industrial system', timeAllocation: 240, pointWeight: 100, questionCount: 12, questionFormat: 'short-answer', instructions: 'Documents fournis en annexe. Calculatrice autorisée.' },
    ],
  },

  // ─── Medical ───
  {
    id: 'usmle-step1',
    name: 'USMLE Step 1',
    category: 'medical',
    sections: Array.from({ length: 7 }, (_, i) => ({
      formatName: `Block ${i + 1}`,
      description: 'Clinical vignette-based MCQ',
      timeAllocation: 60,
      pointWeight: Math.round(100 / 7),
      questionCount: 40,
      questionFormat: 'multiple-choice' as QuestionFormat,
      canGoBack: true,
      instructions: 'Select the single best answer. You may review answers within this block.',
    })),
  },
  {
    id: 'ecn-medecine',
    name: 'ECNi — Médecine (France)',
    category: 'medical',
    sections: [
      { formatName: 'Dossiers Cliniques Progressifs', description: 'Progressive clinical cases', timeAllocation: 180, pointWeight: 70, questionCount: 15, questionFormat: 'multiple-choice', instructions: 'Questions à choix multiples. Une ou plusieurs réponses possibles.' },
      { formatName: 'Questions Isolées', description: 'Standalone clinical questions', timeAllocation: 60, pointWeight: 30, questionCount: 30, questionFormat: 'multiple-choice', canGoBack: true },
    ],
  },

  // ─── Law ───
  {
    id: 'french-bar',
    name: 'Examen du Barreau (CRFPA)',
    category: 'law',
    sections: [
      { formatName: 'Note de synthèse', description: 'Document synthesis from a dossier', timeAllocation: 300, pointWeight: 34, questionCount: 1, questionFormat: 'essay', instructions: 'Dossier de ~15 documents. Rédigez une note de synthèse structurée.' },
      { formatName: 'Épreuve de spécialité', description: 'Specialized law essay or case study', timeAllocation: 180, pointWeight: 33, questionCount: 2, questionFormat: 'essay' },
      { formatName: 'Libertés et droits fondamentaux', description: 'Fundamental rights essay', timeAllocation: 180, pointWeight: 33, questionCount: 2, questionFormat: 'essay' },
    ],
  },

  // ─── Business ───
  {
    id: 'cfa-level1',
    name: 'CFA Level I',
    category: 'business',
    sections: [
      { formatName: 'Morning Session', description: 'Multiple choice questions', timeAllocation: 135, pointWeight: 50, questionCount: 90, questionFormat: 'multiple-choice', canGoBack: true },
      { formatName: 'Afternoon Session', description: 'Multiple choice questions', timeAllocation: 135, pointWeight: 50, questionCount: 90, questionFormat: 'multiple-choice', canGoBack: true },
    ],
  },

  // ─── Language ───
  {
    id: 'ielts-academic',
    name: 'IELTS Academic',
    category: 'language',
    sections: [
      { formatName: 'Listening', description: '4 sections, 40 questions', timeAllocation: 30, pointWeight: 25, questionCount: 40, questionFormat: 'short-answer' },
      { formatName: 'Reading', description: '3 passages, 40 questions', timeAllocation: 60, pointWeight: 25, questionCount: 40, questionFormat: 'short-answer' },
      { formatName: 'Writing', description: 'Task 1 (describe data) + Task 2 (essay)', timeAllocation: 60, pointWeight: 25, questionCount: 2, questionFormat: 'essay' },
      { formatName: 'Speaking', description: '3 parts: introduction, long turn, discussion', timeAllocation: 15, pointWeight: 25, questionCount: 3, questionFormat: 'short-answer', sectionType: 'oral', instructions: 'This is a spoken exam.' },
    ],
  },
  {
    id: 'delf-b2',
    name: 'DELF B2',
    category: 'language',
    sections: [
      { formatName: 'Compréhension orale', description: 'Listening comprehension', timeAllocation: 30, pointWeight: 25, questionCount: 20, questionFormat: 'multiple-choice' },
      { formatName: 'Compréhension écrite', description: 'Reading comprehension', timeAllocation: 60, pointWeight: 25, questionCount: 15, questionFormat: 'short-answer' },
      { formatName: 'Production écrite', description: 'Written production — argumentative essay', timeAllocation: 60, pointWeight: 25, questionCount: 1, questionFormat: 'essay', instructions: 'Rédigez un essai argumentatif de 250 mots minimum.' },
      { formatName: 'Production orale', description: 'Oral presentation + debate', timeAllocation: 20, pointWeight: 25, questionCount: 2, questionFormat: 'short-answer', sectionType: 'oral' },
    ],
  },

  // ─── Technology & Cloud ───
  {
    id: 'aws-associate',
    name: 'AWS Associate Certification (SAA/DVA/SOA/DEA)',
    category: 'technology',
    sections: [
      { formatName: 'Multiple Choice & Multi-Select', description: '65 questions (50 scored + 15 unscored), scenario-based', timeAllocation: 130, pointWeight: 100, questionCount: 65, questionFormat: 'multiple-choice', canGoBack: true, passingScore: 72, instructions: 'Select the best answer. Some questions ask to select 2 or 3 answers.' },
    ],
  },
  {
    id: 'aws-professional',
    name: 'AWS Professional Certification (SAP/DOP)',
    category: 'technology',
    sections: [
      { formatName: 'Multiple Choice & Multi-Select', description: '75 questions (65 scored + 10 unscored), complex scenarios', timeAllocation: 180, pointWeight: 100, questionCount: 75, questionFormat: 'multiple-choice', canGoBack: true, passingScore: 75 },
    ],
  },
  {
    id: 'azure-fundamentals',
    name: 'Azure Fundamentals (AZ-900 / AI-900 / DP-900)',
    category: 'technology',
    sections: [
      { formatName: 'Mixed Format', description: '40-60 questions: MCQ, drag-and-drop, hot area', timeAllocation: 45, pointWeight: 100, questionCount: 50, questionFormat: 'multiple-choice', canGoBack: true, passingScore: 70 },
    ],
  },
  {
    id: 'azure-associate',
    name: 'Azure Associate (AZ-104 / AZ-204 / AZ-305)',
    category: 'technology',
    sections: [
      { formatName: 'Mixed Format + Case Studies', description: '40-60 questions with possible lab simulations', timeAllocation: 100, pointWeight: 100, questionCount: 50, questionFormat: 'multiple-choice', canGoBack: true, passingScore: 70 },
    ],
  },
  {
    id: 'comptia-standard',
    name: 'CompTIA Standard (Security+ / Network+ / Cloud+)',
    category: 'technology',
    sections: [
      { formatName: 'MCQ + Performance-Based', description: 'Up to 90 questions including performance-based questions', timeAllocation: 90, pointWeight: 100, questionCount: 90, questionFormat: 'multiple-choice', canGoBack: true, passingScore: 83, instructions: 'Performance-based questions appear first. MCQ follows.' },
    ],
  },
  {
    id: 'kubernetes-cka',
    name: 'Kubernetes CKA / CKAD / CKS (Performance-Based)',
    category: 'technology',
    sections: [
      { formatName: 'Hands-On Tasks', description: '15-20 performance-based tasks on a live Kubernetes cluster', timeAllocation: 120, pointWeight: 100, questionCount: 17, sectionType: 'practical', passingScore: 66, instructions: 'Entirely hands-on CLI tasks. No multiple choice. Use kubectl commands.' },
    ],
  },

  // ─── General ───
  {
    id: 'generic-mcq',
    name: 'Standard MCQ Exam',
    category: 'general',
    sections: [
      { formatName: 'Multiple Choice', description: 'Standard multiple choice questions', timeAllocation: 90, pointWeight: 100, questionCount: 50, questionFormat: 'multiple-choice', canGoBack: true },
    ],
  },
  {
    id: 'generic-mixed',
    name: 'Mixed Format Exam',
    category: 'general',
    sections: [
      { formatName: 'Part A — MCQ', description: 'Multiple choice', timeAllocation: 45, pointWeight: 40, questionCount: 20, questionFormat: 'multiple-choice' },
      { formatName: 'Part B — Short Answer', description: 'Brief written responses', timeAllocation: 30, pointWeight: 30, questionCount: 5, questionFormat: 'short-answer' },
      { formatName: 'Part C — Essay', description: 'Extended response', timeAllocation: 45, pointWeight: 30, questionCount: 1, questionFormat: 'essay' },
    ],
  },
]

export const PRESET_CATEGORIES: Record<string, string> = {
  engineering: 'Engineering / CPGE',
  medical: 'Medical',
  law: 'Law',
  business: 'Business & Finance',
  technology: 'Technology & Cloud',
  language: 'Language',
  general: 'General',
}
