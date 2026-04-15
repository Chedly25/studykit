import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/clerk-react'
import * as Sentry from '@sentry/react'
import { Layout } from './components/Layout'
import { BrandedLoader } from './components/BrandedLoader'
import { AuthLayout } from './components/AuthLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { runMigration } from './db/migrations'

// Run IndexedDB migration on app load
runMigration().catch(err => Sentry.captureException(err))

// Auto-reload on stale chunk errors (happens after deploy with new hashes)
function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType }>) {
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
// Report and FocusMode removed — merged into Analytics and Queue respectively
const SubjectPage = lazyWithRetry(() => import('./pages/SubjectPage'))
const TopicPage = lazyWithRetry(() => import('./pages/TopicPage'))

// AI
const PracticeExam = lazyWithRetry(() => import('./pages/PracticeExam'))
const StudyPlan = lazyWithRetry(() => import('./pages/StudyPlan'))
const StudySession = lazyWithRetry(() => import('./pages/StudySession'))
const Exercises = lazyWithRetry(() => import('./pages/Exercises'))
const FicheRevisionPage = lazyWithRetry(() => import('./components/fiche/FicheRevisionViewer'))
const ExamDNAPage = lazyWithRetry(() => import('./components/examdna/ExamDNAPage'))
// MockExam removed — superseded by PracticeExam simulation mode
const DailyQueue = lazyWithRetry(() => import('./pages/DailyQueue'))
const DocumentReader = lazyWithRetry(() => import('./pages/DocumentReader'))
const Settings = lazyWithRetry(() => import('./pages/Settings'))

// Admin
const AdminLayout = lazyWithRetry(() => import('./components/admin/AdminLayout'))
const AdminOverview = lazyWithRetry(() => import('./pages/admin/Overview'))
const AdminRevenue = lazyWithRetry(() => import('./pages/admin/Revenue'))
const AdminUsers = lazyWithRetry(() => import('./pages/admin/Users'))
const AdminUsage = lazyWithRetry(() => import('./pages/admin/Usage'))

// Legal
const Privacy = lazyWithRetry(() => import('./pages/Privacy'))
const Terms = lazyWithRetry(() => import('./pages/Terms'))

// Subscription
const Pricing = lazyWithRetry(() => import('./pages/Pricing'))
const SubscriptionSuccess = lazyWithRetry(() => import('./pages/SubscriptionSuccess'))

// Sources
const Sources = lazyWithRetry(() => import('./pages/Sources'))

// Research — removed from routing (Writing, Meetings, Notes merged/deprecated)

// Legal Search
const LegalChat = lazyWithRetry(() => import('./pages/LegalChat'))

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

export default function App() {
  return (
    <Suspense fallback={<BrandedLoader />}>
      <ScrollToTop />
      <Routes>
        {/* Auth routes — outside Layout */}
        <Route path="/sign-in/*" element={<ErrorBoundary><AuthLayout><SignIn routing="path" path="/sign-in" /></AuthLayout></ErrorBoundary>} />
        <Route path="/sign-up/*" element={<ErrorBoundary><AuthLayout><SignUp routing="path" path="/sign-up" /></AuthLayout></ErrorBoundary>} />

        {/* Admin routes — outside Layout */}
        <Route path="admin" element={<ErrorBoundary><AdminLayout /></ErrorBoundary>}>
          <Route index element={<AdminOverview />} />
          <Route path="revenue" element={<AdminRevenue />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="usage" element={<AdminUsage />} />
        </Route>

        <Route element={<ErrorBoundary><Layout /></ErrorBoundary>}>
          {/* Public */}
          <Route index element={<Home />} />
          <Route path="all-tools" element={<AllTools />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />

          {/* Protected — Subscription */}
          <Route path="subscription/success" element={<ProtectedRoute><SubscriptionSuccess /></ProtectedRoute>} />

          {/* Protected — Command Center */}
          <Route path="welcome" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="subject/:subjectId" element={<ProtectedRoute><SubjectPage /></ProtectedRoute>} />
          <Route path="topic/:topicId" element={<ProtectedRoute><TopicPage /></ProtectedRoute>} />
          <Route path="exam-profile" element={<ProtectedRoute><ExamProfile /></ProtectedRoute>} />
          <Route path="analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          {/* /report and /focus removed — merged into analytics and queue */}

          {/* Protected — AI */}
          <Route path="practice-exam" element={<ProtectedRoute><PracticeExam /></ProtectedRoute>} />
          <Route path="fiche/:topicId" element={<ProtectedRoute><FicheRevisionPage /></ProtectedRoute>} />
          <Route path="exam-dna" element={<ProtectedRoute><ExamDNAPage /></ProtectedRoute>} />
          <Route path="study-plan" element={<ProtectedRoute><StudyPlan /></ProtectedRoute>} />
          <Route path="session" element={<ProtectedRoute><StudySession /></ProtectedRoute>} />
          <Route path="exercises" element={<ProtectedRoute><Exercises /></ProtectedRoute>} />
          {/* /mock-exam removed — superseded by practice-exam simulation mode */}
          <Route path="queue" element={<ProtectedRoute><DailyQueue /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="sources" element={<ProtectedRoute><Sources /></ProtectedRoute>} />
          <Route path="read/:documentId" element={<ProtectedRoute><DocumentReader /></ProtectedRoute>} />
          {/* /writing, /meetings, /notes removed — research features deprecated */}
          <Route path="article-review" element={<ProtectedRoute><ArticleReview /></ProtectedRoute>} />
          <Route path="legal" element={<ProtectedRoute><LegalChat /></ProtectedRoute>} />

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
