import type { LucideIcon } from 'lucide-react'
import {
  Calculator,
  GraduationCap,
  Award,
  FileText,
  Quote,
  Timer,
  CalendarClock,
  BarChart3,
  Layers,
  Atom,
  Ruler,
  PenLine,
  ListChecks,
  Headphones,
} from 'lucide-react'

export type ToolCategory = 'grades' | 'writing' | 'study' | 'reference'

export interface Tool {
  id: string
  name: string
  slug: string
  description: string
  category: ToolCategory
  seoTitle: string
  seoDescription: string
  icon: LucideIcon
  keywords: string[]
}

export interface CategoryMeta {
  id: ToolCategory
  label: string
  description: string
  icon: LucideIcon
}

export const categories: CategoryMeta[] = [
  {
    id: 'grades',
    label: 'Grade Calculators',
    description: 'GPA, grades, and final exam scores',
    icon: Calculator,
  },
  {
    id: 'writing',
    label: 'Writing Tools',
    description: 'Word count and citations',
    icon: PenLine,
  },
  {
    id: 'study',
    label: 'Study Tools',
    description: 'Timers, flashcards, tracking, and focus',
    icon: Timer,
  },
  {
    id: 'reference',
    label: 'Reference',
    description: 'Periodic table and unit converter',
    icon: Atom,
  },
]

export const tools: Tool[] = [
  // Grades
  {
    id: 'gpa-calculator',
    name: 'GPA Calculator',
    slug: 'gpa-calculator',
    description: 'Calculate your weighted GPA on 4.0 or 5.0 scale',
    category: 'grades',
    seoTitle: 'Free GPA Calculator — Calculate Your Grade Point Average',
    seoDescription: 'Calculate your cumulative GPA instantly. Add courses with credits and grades. Supports 4.0 and 5.0 grading scales. Free, no sign-up required.',
    icon: GraduationCap,
    keywords: ['gpa calculator', 'grade point average', 'college gpa', 'cumulative gpa'],
  },
  {
    id: 'grade-calculator',
    name: 'Grade Calculator',
    slug: 'grade-calculator',
    description: 'Calculate your weighted grade from assignments',
    category: 'grades',
    seoTitle: 'Free Grade Calculator — Weighted Grade Calculator',
    seoDescription: 'Calculate your current grade with weighted assignments. Add scores and weights to see your overall grade and letter grade instantly.',
    icon: Calculator,
    keywords: ['grade calculator', 'weighted grade', 'class grade calculator', 'assignment grade'],
  },
  {
    id: 'final-grade-calculator',
    name: 'Final Grade Calculator',
    slug: 'final-grade-calculator',
    description: 'Find out what you need on the final exam',
    category: 'grades',
    seoTitle: 'Final Grade Calculator — What Do I Need on My Final?',
    seoDescription: 'Calculate the minimum grade you need on your final exam to get your desired course grade. Enter your current grade and final exam weight.',
    icon: Award,
    keywords: ['final grade calculator', 'final exam calculator', 'what do i need on my final'],
  },

  // Writing
  {
    id: 'word-counter',
    name: 'Word Counter',
    slug: 'word-counter',
    description: 'Count words, characters, sentences, and reading time',
    category: 'writing',
    seoTitle: 'Free Word Counter — Count Words, Characters & Reading Time',
    seoDescription: 'Count words, characters, sentences, and paragraphs instantly. See reading time and speaking time. Free online word counter tool.',
    icon: FileText,
    keywords: ['word counter', 'character counter', 'word count', 'reading time calculator'],
  },
  {
    id: 'citation-generator',
    name: 'Citation Generator',
    slug: 'citation-generator',
    description: 'Generate APA, MLA, Chicago, and Harvard citations',
    category: 'writing',
    seoTitle: 'Free Citation Generator — APA, MLA, Chicago, Harvard',
    seoDescription: 'Generate citations in APA, MLA, Chicago, and Harvard formats. Support for books, websites, journals, and videos. Copy with one click.',
    icon: Quote,
    keywords: ['citation generator', 'apa citation', 'mla citation', 'bibliography generator'],
  },

  // Study
  {
    id: 'pomodoro-timer',
    name: 'Pomodoro Timer',
    slug: 'pomodoro-timer',
    description: 'Focus timer with work and break intervals',
    category: 'study',
    seoTitle: 'Free Pomodoro Timer — Focus Timer for Studying',
    seoDescription: 'Boost your study productivity with the Pomodoro technique. Customizable work and break durations. Session tracking and daily stats.',
    icon: Timer,
    keywords: ['pomodoro timer', 'study timer', 'focus timer', 'pomodoro technique'],
  },
  {
    id: 'exam-countdown',
    name: 'Exam Countdown',
    slug: 'exam-countdown',
    description: 'Countdown timer for upcoming exams',
    category: 'study',
    seoTitle: 'Exam Countdown Timer — Track Days Until Your Exams',
    seoDescription: 'Never miss an exam date. Add your exams and see countdown timers showing days, hours, and minutes remaining. Saved automatically.',
    icon: CalendarClock,
    keywords: ['exam countdown', 'exam timer', 'days until exam', 'test countdown'],
  },
  {
    id: 'study-time-tracker',
    name: 'Study Time Tracker',
    slug: 'study-time-tracker',
    description: 'Track study hours by subject',
    category: 'study',
    seoTitle: 'Study Time Tracker — Track Your Study Hours by Subject',
    seoDescription: 'Track how much time you spend studying each subject. Start/stop timer, view weekly statistics. All data saved locally.',
    icon: BarChart3,
    keywords: ['study time tracker', 'study hours tracker', 'study log', 'time tracker'],
  },
  {
    id: 'flashcard-maker',
    name: 'Smart Flashcards',
    slug: 'flashcard-maker',
    description: 'Create and study flashcards with spaced repetition',
    category: 'study',
    seoTitle: 'Smart Flashcards — Spaced Repetition Flashcard Maker',
    seoDescription: 'Create flashcard decks and study with the SM-2 spaced repetition algorithm. Track your progress with due cards, mastery stats, and review scheduling.',
    icon: Layers,
    keywords: ['flashcard maker', 'spaced repetition', 'flashcards online', 'sm2 flashcards', 'study flashcards'],
  },
  {
    id: 'assignment-tracker',
    name: 'Assignment Tracker',
    slug: 'assignment-tracker',
    description: 'Track homework and projects with due dates',
    category: 'study',
    seoTitle: 'Assignment Tracker — Track Homework & Project Due Dates',
    seoDescription: 'Keep track of all your assignments with due dates, priority levels, and status. Sort and filter to stay organized. Saved automatically.',
    icon: ListChecks,
    keywords: ['assignment tracker', 'homework tracker', 'due date tracker', 'student planner'],
  },
  {
    id: 'ambient-sound-generator',
    name: 'Ambient Sound Generator',
    slug: 'ambient-sound-generator',
    description: 'Mix white noise, rain, and more for focus',
    category: 'study',
    seoTitle: 'Ambient Sound Generator — White Noise, Rain & Focus Sounds',
    seoDescription: 'Create your perfect study atmosphere. Mix white noise, rain, coffee shop, and lo-fi sounds. Adjustable volume for each sound.',
    icon: Headphones,
    keywords: ['ambient sounds', 'white noise generator', 'study sounds', 'focus sounds'],
  },

  // Reference
  {
    id: 'periodic-table',
    name: 'Periodic Table',
    slug: 'periodic-table',
    description: 'Interactive periodic table of elements',
    category: 'reference',
    seoTitle: 'Interactive Periodic Table — All 118 Elements',
    seoDescription: 'Explore all 118 elements with an interactive periodic table. Click elements for details. Color-coded by category. Search and filter.',
    icon: Atom,
    keywords: ['periodic table', 'elements', 'chemistry', 'periodic table of elements'],
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    slug: 'unit-converter',
    description: 'Convert between units of measurement',
    category: 'reference',
    seoTitle: 'Free Unit Converter — Length, Weight, Temperature & More',
    seoDescription: 'Convert between units of length, weight, temperature, volume, area, speed, and time. Fast, free, and accurate unit converter.',
    icon: Ruler,
    keywords: ['unit converter', 'measurement converter', 'convert units', 'metric converter'],
  },
]

export function getToolsByCategory(category: ToolCategory): Tool[] {
  return tools.filter(t => t.category === category)
}

export function getToolBySlug(slug: string): Tool | undefined {
  return tools.find(t => t.slug === slug)
}

export function getCategoryMeta(id: ToolCategory): CategoryMeta | undefined {
  return categories.find(c => c.id === id)
}
