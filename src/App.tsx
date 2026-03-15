import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'

// Pages
const Home = lazy(() => import('./pages/Home'))
const AllTools = lazy(() => import('./pages/AllTools'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Calculator tools
const GpaCalculator = lazy(() => import('./pages/tools/GpaCalculator'))
const GradeCalculator = lazy(() => import('./pages/tools/GradeCalculator'))
const FinalGradeCalculator = lazy(() => import('./pages/tools/FinalGradeCalculator'))
const PercentageCalculator = lazy(() => import('./pages/tools/PercentageCalculator'))
const GpaToLetterGrade = lazy(() => import('./pages/tools/GpaToLetterGrade'))

// Writing tools
const WordCounter = lazy(() => import('./pages/tools/WordCounter'))
const CitationGenerator = lazy(() => import('./pages/tools/CitationGenerator'))
const ParaphrasingHelper = lazy(() => import('./pages/tools/ParaphrasingHelper'))
const EssayOutlineGenerator = lazy(() => import('./pages/tools/EssayOutlineGenerator'))
const ReadingTimeCalculator = lazy(() => import('./pages/tools/ReadingTimeCalculator'))

// Timer tools
const PomodoroTimer = lazy(() => import('./pages/tools/PomodoroTimer'))
const ExamCountdown = lazy(() => import('./pages/tools/ExamCountdown'))
const StudyTimeTracker = lazy(() => import('./pages/tools/StudyTimeTracker'))

// Flashcards & Study tools
const FlashcardMaker = lazy(() => import('./pages/tools/FlashcardMaker'))
const RandomGroupGenerator = lazy(() => import('./pages/tools/RandomGroupGenerator'))
const QuizMaker = lazy(() => import('./pages/tools/QuizMaker'))
const CornellNotes = lazy(() => import('./pages/tools/CornellNotes'))

// Reference tools
const PeriodicTable = lazy(() => import('./pages/tools/PeriodicTable'))
const UnitConverter = lazy(() => import('./pages/tools/UnitConverter'))
const MathFormulaReference = lazy(() => import('./pages/tools/MathFormulaReference'))

function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="all-tools" element={<AllTools />} />

          {/* Calculators */}
          <Route path="gpa-calculator" element={<GpaCalculator />} />
          <Route path="grade-calculator" element={<GradeCalculator />} />
          <Route path="final-grade-calculator" element={<FinalGradeCalculator />} />
          <Route path="percentage-calculator" element={<PercentageCalculator />} />
          <Route path="gpa-to-letter-grade" element={<GpaToLetterGrade />} />

          {/* Writing */}
          <Route path="word-counter" element={<WordCounter />} />
          <Route path="citation-generator" element={<CitationGenerator />} />
          <Route path="paraphrasing-helper" element={<ParaphrasingHelper />} />
          <Route path="essay-outline-generator" element={<EssayOutlineGenerator />} />
          <Route path="reading-time-calculator" element={<ReadingTimeCalculator />} />

          {/* Timers */}
          <Route path="pomodoro-timer" element={<PomodoroTimer />} />
          <Route path="exam-countdown" element={<ExamCountdown />} />
          <Route path="study-time-tracker" element={<StudyTimeTracker />} />

          {/* Flashcards & Study */}
          <Route path="flashcard-maker" element={<FlashcardMaker />} />
          <Route path="random-group-generator" element={<RandomGroupGenerator />} />
          <Route path="quiz-maker" element={<QuizMaker />} />
          <Route path="cornell-notes" element={<CornellNotes />} />

          {/* Reference */}
          <Route path="periodic-table" element={<PeriodicTable />} />
          <Route path="unit-converter" element={<UnitConverter />} />
          <Route path="math-formula-reference" element={<MathFormulaReference />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
