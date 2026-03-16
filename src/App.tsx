import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { Layout } from './components/Layout'
import { AuthLayout } from './components/AuthLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { runMigration } from './db/migrations'

// Run IndexedDB migration on app load
runMigration().catch(console.warn)

// Pages
const Home = lazy(() => import('./pages/Home'))
const AllTools = lazy(() => import('./pages/AllTools'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Command Center
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ExamProfile = lazy(() => import('./pages/ExamProfile'))
const Analytics = lazy(() => import('./pages/Analytics'))
const FocusMode = lazy(() => import('./pages/FocusMode'))

// AI
const Chat = lazy(() => import('./pages/Chat'))
const SocraticMode = lazy(() => import('./pages/SocraticMode'))
const PracticeExam = lazy(() => import('./pages/PracticeExam'))
const ExplainBack = lazy(() => import('./pages/ExplainBack'))
const StudyPlan = lazy(() => import('./pages/StudyPlan'))
const MockExam = lazy(() => import('./pages/MockExam'))

// Admin
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'))
const AdminOverview = lazy(() => import('./pages/admin/Overview'))
const AdminRevenue = lazy(() => import('./pages/admin/Revenue'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AdminUsage = lazy(() => import('./pages/admin/Usage'))

// Subscription
const Pricing = lazy(() => import('./pages/Pricing'))
const SubscriptionSuccess = lazy(() => import('./pages/SubscriptionSuccess'))

// Sources
const Sources = lazy(() => import('./pages/Sources'))

// Research
const Writing = lazy(() => import('./pages/Writing'))
const Meetings = lazy(() => import('./pages/Meetings'))
const Notes = lazy(() => import('./pages/Notes'))

// Grades
const GpaCalculator = lazy(() => import('./pages/tools/GpaCalculator'))
const GradeCalculator = lazy(() => import('./pages/tools/GradeCalculator'))
const FinalGradeCalculator = lazy(() => import('./pages/tools/FinalGradeCalculator'))

// Writing
const WordCounter = lazy(() => import('./pages/tools/WordCounter'))
const CitationGenerator = lazy(() => import('./pages/tools/CitationGenerator'))

// Study
const PomodoroTimer = lazy(() => import('./pages/tools/PomodoroTimer'))
const ExamCountdown = lazy(() => import('./pages/tools/ExamCountdown'))
const StudyTimeTracker = lazy(() => import('./pages/tools/StudyTimeTracker'))
const FlashcardMaker = lazy(() => import('./pages/tools/FlashcardMaker'))
const AssignmentTracker = lazy(() => import('./pages/tools/AssignmentTracker'))
const AmbientSoundGenerator = lazy(() => import('./pages/tools/AmbientSoundGenerator'))

// Reference
const UnitConverter = lazy(() => import('./pages/tools/UnitConverter'))
const PeriodicTable = lazy(() => import('./pages/tools/PeriodicTable'))

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
          <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="exam-profile" element={<ProtectedRoute><ExamProfile /></ProtectedRoute>} />
          <Route path="analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="focus" element={<ProtectedRoute><FocusMode /></ProtectedRoute>} />

          {/* Protected — AI */}
          <Route path="chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="socratic" element={<ProtectedRoute><SocraticMode /></ProtectedRoute>} />
          <Route path="practice-exam" element={<ProtectedRoute><PracticeExam /></ProtectedRoute>} />
          <Route path="explain-back" element={<ProtectedRoute><ExplainBack /></ProtectedRoute>} />
          <Route path="study-plan" element={<ProtectedRoute><StudyPlan /></ProtectedRoute>} />
          <Route path="mock-exam" element={<ProtectedRoute><MockExam /></ProtectedRoute>} />
          <Route path="sources" element={<ProtectedRoute><Sources /></ProtectedRoute>} />
          <Route path="writing" element={<ProtectedRoute><Writing /></ProtectedRoute>} />
          <Route path="meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
          <Route path="notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />

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
