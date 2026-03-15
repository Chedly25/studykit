import type { LucideIcon } from 'lucide-react'
import {
  Calculator,
  GraduationCap,
  Percent,
  ArrowRightLeft,
  Award,
  FileText,
  Quote,
  BookOpen,
  ListTree,
  Clock,
  Timer,
  CalendarClock,
  BarChart3,
  Layers,
  Users,
  HelpCircle,
  StickyNote,
  Atom,
  Ruler,
  FunctionSquare,
  PenLine,
} from 'lucide-react'

export type ToolCategory = 'calculators' | 'writing' | 'timers' | 'flashcards' | 'reference'

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
    id: 'calculators',
    label: 'Calculators',
    description: 'GPA, grades, percentages, and more',
    icon: Calculator,
  },
  {
    id: 'writing',
    label: 'Writing Tools',
    description: 'Word count, citations, outlines, and more',
    icon: PenLine,
  },
  {
    id: 'timers',
    label: 'Study Timers',
    description: 'Pomodoro, exam countdown, time tracking',
    icon: Timer,
  },
  {
    id: 'flashcards',
    label: 'Flashcards & Study',
    description: 'Flashcards, quizzes, notes, and groups',
    icon: Layers,
  },
  {
    id: 'reference',
    label: 'Reference',
    description: 'Periodic table, unit converter, math formulas',
    icon: Atom,
  },
]

export const tools: Tool[] = [
  // Calculators
  {
    id: 'gpa-calculator',
    name: 'GPA Calculator',
    slug: 'gpa-calculator',
    description: 'Calculate your weighted GPA on 4.0 or 5.0 scale',
    category: 'calculators',
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
    category: 'calculators',
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
    category: 'calculators',
    seoTitle: 'Final Grade Calculator — What Do I Need on My Final?',
    seoDescription: 'Calculate the minimum grade you need on your final exam to get your desired course grade. Enter your current grade and final exam weight.',
    icon: Award,
    keywords: ['final grade calculator', 'final exam calculator', 'what do i need on my final'],
  },
  {
    id: 'percentage-calculator',
    name: 'Percentage Calculator',
    slug: 'percentage-calculator',
    description: 'Calculate percentages in three different modes',
    category: 'calculators',
    seoTitle: 'Free Percentage Calculator — Calculate Percentages Instantly',
    seoDescription: 'Calculate percentages easily. Find X% of Y, what percent X is of Y, or percentage increase/decrease. Free online percentage calculator.',
    icon: Percent,
    keywords: ['percentage calculator', 'percent calculator', 'percentage increase', 'percentage decrease'],
  },
  {
    id: 'gpa-to-letter-grade',
    name: 'GPA to Letter Grade',
    slug: 'gpa-to-letter-grade',
    description: 'Convert between GPA and letter grades',
    category: 'calculators',
    seoTitle: 'GPA to Letter Grade Converter — Free Conversion Chart',
    seoDescription: 'Convert GPA to letter grade and letter grade to GPA instantly. Visual scale chart with A+ through F grades on 4.0 scale.',
    icon: ArrowRightLeft,
    keywords: ['gpa to letter grade', 'letter grade to gpa', 'gpa converter', 'grade conversion'],
  },
  // Writing Tools
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
  {
    id: 'paraphrasing-helper',
    name: 'Paraphrasing Helper',
    slug: 'paraphrasing-helper',
    description: 'Tips and techniques for rewriting text',
    category: 'writing',
    seoTitle: 'Paraphrasing Helper — Tips for Rewriting Text',
    seoDescription: 'Learn paraphrasing techniques with synonym suggestions and sentence restructuring tips. Improve your academic writing skills.',
    icon: BookOpen,
    keywords: ['paraphrasing helper', 'paraphrase tool', 'rewrite text', 'synonym finder'],
  },
  {
    id: 'essay-outline-generator',
    name: 'Essay Outline Generator',
    slug: 'essay-outline-generator',
    description: 'Generate structured essay outlines by type',
    category: 'writing',
    seoTitle: 'Free Essay Outline Generator — Create Structured Outlines',
    seoDescription: 'Generate essay outlines for argumentative, expository, persuasive, and compare-contrast essays. Enter your topic and get a structured template.',
    icon: ListTree,
    keywords: ['essay outline generator', 'essay outline', 'essay template', 'essay structure'],
  },
  {
    id: 'reading-time-calculator',
    name: 'Reading Time Calculator',
    slug: 'reading-time-calculator',
    description: 'Estimate reading time for any text',
    category: 'writing',
    seoTitle: 'Reading Time Calculator — How Long to Read Your Text',
    seoDescription: 'Calculate how long it takes to read any text. Paste text or enter word count. Adjustable reading speed from 200-400 WPM.',
    icon: Clock,
    keywords: ['reading time calculator', 'reading time estimator', 'how long to read'],
  },
  // Study Timers
  {
    id: 'pomodoro-timer',
    name: 'Pomodoro Timer',
    slug: 'pomodoro-timer',
    description: 'Focus timer with work and break intervals',
    category: 'timers',
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
    category: 'timers',
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
    category: 'timers',
    seoTitle: 'Study Time Tracker — Track Your Study Hours by Subject',
    seoDescription: 'Track how much time you spend studying each subject. Start/stop timer, view weekly statistics. All data saved locally.',
    icon: BarChart3,
    keywords: ['study time tracker', 'study hours tracker', 'study log', 'time tracker'],
  },
  // Flashcards & Study
  {
    id: 'flashcard-maker',
    name: 'Flashcard Maker',
    slug: 'flashcard-maker',
    description: 'Create and study flashcard decks',
    category: 'flashcards',
    seoTitle: 'Free Flashcard Maker — Create & Study Flashcards Online',
    seoDescription: 'Create flashcard decks with front and back sides. Flip, shuffle, and track known/unknown cards. Import and export as JSON.',
    icon: Layers,
    keywords: ['flashcard maker', 'flashcards online', 'study flashcards', 'digital flashcards'],
  },
  {
    id: 'random-group-generator',
    name: 'Random Group Generator',
    slug: 'random-group-generator',
    description: 'Split names into random groups',
    category: 'flashcards',
    seoTitle: 'Random Group Generator — Split People into Random Teams',
    seoDescription: 'Enter names and split them into random groups instantly. Perfect for class projects, team assignments, and group activities.',
    icon: Users,
    keywords: ['random group generator', 'team generator', 'group maker', 'random teams'],
  },
  {
    id: 'quiz-maker',
    name: 'Quiz Maker',
    slug: 'quiz-maker',
    description: 'Create and take multiple-choice quizzes',
    category: 'flashcards',
    seoTitle: 'Free Quiz Maker — Create Multiple Choice Quizzes',
    seoDescription: 'Create multiple-choice quizzes and test yourself. Track your scores. Save quizzes locally for later review.',
    icon: HelpCircle,
    keywords: ['quiz maker', 'quiz creator', 'multiple choice quiz', 'online quiz maker'],
  },
  {
    id: 'cornell-notes',
    name: 'Cornell Notes',
    slug: 'cornell-notes',
    description: 'Take notes using the Cornell method',
    category: 'flashcards',
    seoTitle: 'Cornell Notes Template — Free Online Note-Taking Tool',
    seoDescription: 'Take notes using the Cornell method with cues, notes, and summary sections. Save and load notes. Export as text.',
    icon: StickyNote,
    keywords: ['cornell notes', 'cornell method', 'note taking', 'study notes'],
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
  {
    id: 'math-formula-reference',
    name: 'Math Formula Reference',
    slug: 'math-formula-reference',
    description: 'Searchable collection of math formulas',
    category: 'reference',
    seoTitle: 'Math Formula Reference — Algebra, Geometry, Calculus & More',
    seoDescription: 'Browse and search 50+ math formulas organized by topic. Algebra, geometry, trigonometry, calculus, and statistics formulas.',
    icon: FunctionSquare,
    keywords: ['math formulas', 'math reference', 'algebra formulas', 'geometry formulas'],
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
