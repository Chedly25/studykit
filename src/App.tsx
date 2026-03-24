import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { Layout } from './components/Layout'
import { AuthLayout } from './components/AuthLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { runMigration } from './db/migrations'

// Run IndexedDB migration on app load
runMigration().catch(console.warn)

// Auto-reload on stale chunk errors (happens after deploy with new hashes)
function lazyWithRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn().catch(() => {
      // Chunk failed to load — likely a stale deploy. Reload once.
      const key = 'chunk_reload'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        window.location.reload()
        // Return a never-resolving promise to prevent React from erroring
        // while the page reloads
        return new Promise(() => {})
      }
      // Already reloaded once — clear flag and retry import
      sessionStorage.removeItem(key)
      return importFn()
    })
  )
}

// Pages
const Home = lazyWithRetry(() => import('./pages/Home'))
const AllTools = lazyWithRetry(() => import('./pages/AllTools'))
const NotFound = lazyWithRetry(() => import('./pages/NotFound'))

// Command Center
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding'))
const ExamProfile = lazyWithRetry(() => import('./pages/ExamProfile'))
const Analytics = lazyWithRetry(() => import('./pages/Analytics'))
const Report = lazyWithRetry(() => import('./pages/Report'))
const FocusMode = lazyWithRetry(() => import('./pages/FocusMode'))
const SubjectPage = lazyWithRetry(() => import('./pages/SubjectPage'))
const TopicPage = lazyWithRetry(() => import('./pages/TopicPage'))

// AI
const PracticeExam = lazyWithRetry(() => import('./pages/PracticeExam'))
const StudyPlan = lazyWithRetry(() => import('./pages/StudyPlan'))
const StudySession = lazyWithRetry(() => import('./pages/StudySession'))
const Exercises = lazyWithRetry(() => import('./pages/Exercises'))
const MockExam = lazyWithRetry(() => import('./pages/MockExam'))
const DailyQueue = lazyWithRetry(() => import('./pages/DailyQueue'))
const DocumentReader = lazyWithRetry(() => import('./pages/DocumentReader'))
const Settings = lazyWithRetry(() => import('./pages/Settings'))

// Admin
const AdminLayout = lazyWithRetry(() => import('./components/admin/AdminLayout'))
const AdminOverview = lazyWithRetry(() => import('./pages/admin/Overview'))
const AdminRevenue = lazyWithRetry(() => import('./pages/admin/Revenue'))
const AdminUsers = lazyWithRetry(() => import('./pages/admin/Users'))
const AdminUsage = lazyWithRetry(() => import('./pages/admin/Usage'))

// Subscription
const Pricing = lazyWithRetry(() => import('./pages/Pricing'))
const SubscriptionSuccess = lazyWithRetry(() => import('./pages/SubscriptionSuccess'))

// Sources
const Sources = lazyWithRetry(() => import('./pages/Sources'))

// Research
const Writing = lazyWithRetry(() => import('./pages/Writing'))
const Meetings = lazyWithRetry(() => import('./pages/Meetings'))
const Notes = lazyWithRetry(() => import('./pages/Notes'))

// Article Review
const ArticleReview = lazyWithRetry(() => import('./pages/ArticleReview'))

// Grades
const GpaCalculator = lazyWithRetry(() => import('./pages/tools/GpaCalculator'))
const GradeCalculator = lazyWithRetry(() => import('./pages/tools/GradeCalculator'))
const FinalGradeCalculator = lazyWithRetry(() => import('./pages/tools/FinalGradeCalculator'))

// Writing
const WordCounter = lazyWithRetry(() => import('./pages/tools/WordCounter'))
const CitationGenerator = lazyWithRetry(() => import('./pages/tools/CitationGenerator'))

// Study
const PomodoroTimer = lazyWithRetry(() => import('./pages/tools/PomodoroTimer'))
const ExamCountdown = lazyWithRetry(() => import('./pages/tools/ExamCountdown'))
const StudyTimeTracker = lazyWithRetry(() => import('./pages/tools/StudyTimeTracker'))
const FlashcardMaker = lazyWithRetry(() => import('./pages/tools/FlashcardMaker'))
const AssignmentTracker = lazyWithRetry(() => import('./pages/tools/AssignmentTracker'))
const AmbientSoundGenerator = lazyWithRetry(() => import('./pages/tools/AmbientSoundGenerator'))

// Reference
const UnitConverter = lazyWithRetry(() => import('./pages/tools/UnitConverter'))
const PeriodicTable = lazyWithRetry(() => import('./pages/tools/PeriodicTable'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

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
      <ScrollToTop />
      <Routes>
        {/* Auth routes — outside Layout */}
        <Route path="/sign-in/*" element={<AuthLayout><SignIn routing="path" path="/sign-in" /></AuthLayout>} />
        <Route path="/sign-up/*" element={<AuthLayout><SignUp routing="path" path="/sign-up" /></AuthLayout>} />

        {/* Admin routes — outside Layout */}
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="revenue" element={<AdminRevenue />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="usage" element={<AdminUsage />} />
        </Route>

        <Route element={<Layout />}>
          {/* Public */}
          <Route index element={<Home />} />
          <Route path="all-tools" element={<AllTools />} />
          <Route path="pricing" element={<Pricing />} />

          {/* Protected — Subscription */}
          <Route path="subscription/success" element={<ProtectedRoute><SubscriptionSuccess /></ProtectedRoute>} />

          {/* Protected — Command Center */}
          <Route path="welcome" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="subject/:subjectId" element={<ProtectedRoute><SubjectPage /></ProtectedRoute>} />
          <Route path="topic/:topicId" element={<ProtectedRoute><TopicPage /></ProtectedRoute>} />
          <Route path="exam-profile" element={<ProtectedRoute><ExamProfile /></ProtectedRoute>} />
          <Route path="analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="focus" element={<ProtectedRoute><FocusMode /></ProtectedRoute>} />

          {/* Protected — AI */}
          <Route path="practice-exam" element={<ProtectedRoute><PracticeExam /></ProtectedRoute>} />
          <Route path="study-plan" element={<ProtectedRoute><StudyPlan /></ProtectedRoute>} />
          <Route path="session" element={<ProtectedRoute><StudySession /></ProtectedRoute>} />
          <Route path="exercises" element={<ProtectedRoute><Exercises /></ProtectedRoute>} />
          <Route path="mock-exam" element={<ProtectedRoute><MockExam /></ProtectedRoute>} />
          <Route path="queue" element={<ProtectedRoute><DailyQueue /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="sources" element={<ProtectedRoute><Sources /></ProtectedRoute>} />
          <Route path="read/:documentId" element={<ProtectedRoute><DocumentReader /></ProtectedRoute>} />
          <Route path="writing" element={<ProtectedRoute><Writing /></ProtectedRoute>} />
          <Route path="meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
          <Route path="notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
          <Route path="article-review" element={<ProtectedRoute><ArticleReview /></ProtectedRoute>} />

          {/* Public — Grades */}
          <Route path="gpa-calculator" element={<GpaCalculator />} />
          <Route path="grade-calculator" element={<GradeCalculator />} />
          <Route path="final-grade-calculator" element={<FinalGradeCalculator />} />

          {/* Public — Writing */}
          <Route path="word-counter" element={<WordCounter />} />
          <Route path="citation-generator" element={<CitationGenerator />} />

          {/* Protected — Study */}
          <Route path="pomodoro-timer" element={<ProtectedRoute><PomodoroTimer /></ProtectedRoute>} />
          <Route path="exam-countdown" element={<ProtectedRoute><ExamCountdown /></ProtectedRoute>} />
          <Route path="study-time-tracker" element={<ProtectedRoute><StudyTimeTracker /></ProtectedRoute>} />
          <Route path="flashcard-maker" element={<ProtectedRoute><FlashcardMaker /></ProtectedRoute>} />
          <Route path="assignment-tracker" element={<ProtectedRoute><AssignmentTracker /></ProtectedRoute>} />
          <Route path="ambient-sound-generator" element={<ProtectedRoute><AmbientSoundGenerator /></ProtectedRoute>} />

          {/* Public — Reference */}
          <Route path="unit-converter" element={<UnitConverter />} />
          <Route path="periodic-table" element={<PeriodicTable />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
