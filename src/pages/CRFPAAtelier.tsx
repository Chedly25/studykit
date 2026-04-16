/**
 * CRFPA Atelier — the home of the CRFPA vertical.
 * Action-chip canvas. No productivity dashboard. No streaks. No "you're late."
 * Only personalization: an optional "Reprendre" card if she has in-progress work,
 * and a small "last 3 exercises" strip at the bottom (scores, no comparison).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useUser } from '@clerk/clerk-react'
import { PenSquare, ListTree, FileText, Scale, FolderOpen, RotateCcw, ArrowRight } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useProfileVertical } from '../hooks/useProfileVertical'
import { listSyllogismeSessions, type SyllogismeSessionView } from '../ai/coaching/syllogismeStore'
import { listPlanSessions, type PlanSessionView } from '../ai/coaching/planStore'
import { listFicheSessions, type FicheSessionView } from '../ai/coaching/ficheArretStore'

type RecentItem =
  | { kind: 'syllogisme'; id: string; title: string; score?: number; createdAt: string }
  | { kind: 'plan'; id: string; title: string; score?: number; createdAt: string }
  | { kind: 'fiche'; id: string; title: string; score?: number; createdAt: string }

const FALLBACK_PROFILE_ID = 'legal-chat'

export default function CRFPAAtelier() {
  const { user } = useUser()
  const navigate = useNavigate()
  const { activeProfile } = useExamProfile()
  const { isCRFPA } = useProfileVertical()
  const examProfileId = activeProfile?.id ?? FALLBACK_PROFILE_ID

  const [syllogismes, setSyllogismes] = useState<SyllogismeSessionView[]>([])
  const [plans, setPlans] = useState<PlanSessionView[]>([])
  const [fiches, setFiches] = useState<FicheSessionView[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listSyllogismeSessions(examProfileId),
      listPlanSessions(examProfileId),
      listFicheSessions(examProfileId),
    ]).then(([s, p, f]) => {
      if (cancelled) return
      setSyllogismes(s)
      setPlans(p)
      setFiches(f)
    })
    return () => { cancelled = true }
  }, [examProfileId])

  // Optional countdown — memoized; recomputes only when the exam date changes.
  const daysUntilExam = useMemo<number | null>(() => {
    if (!activeProfile?.examDate) return null
    // eslint-disable-next-line react-hooks/purity -- Date.now() inside useMemo is cached by deps
    const diff = new Date(activeProfile.examDate).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / 86400000))
  }, [activeProfile?.examDate])

  // Non-CRFPA users should not land here
  if (!isCRFPA) return <Navigate to="/dashboard" replace />

  const firstName = user?.firstName
  const showCountdown = daysUntilExam !== null && daysUntilExam > 0 && daysUntilExam <= 120

  // In-progress: a session with submission but no grading
  const inProgressSyllogisme = syllogismes.find(s => s.submission && !s.grading)
  const inProgressPlan = plans.find(p => p.submission && !p.grading)
  const inProgressFiche = fiches.find(f => f.submission && !f.grading)
  const inProgress = inProgressSyllogisme
    ? { kind: 'syllogisme' as const, id: inProgressSyllogisme.id, title: inProgressSyllogisme.task.theme }
    : inProgressPlan
    ? { kind: 'plan' as const, id: inProgressPlan.id, title: inProgressPlan.task.themeLabel }
    : inProgressFiche
    ? { kind: 'fiche' as const, id: inProgressFiche.id, title: inProgressFiche.task.decision.chamber }
    : null

  // Recent 3 graded
  const recent: RecentItem[] = [
    ...syllogismes
      .filter(s => s.grading)
      .map(s => ({
        kind: 'syllogisme' as const,
        id: s.id,
        title: s.task.theme,
        score: s.grading!.overall.score,
        createdAt: s.createdAt,
      })),
    ...plans
      .filter(p => p.grading)
      .map(p => ({
        kind: 'plan' as const,
        id: p.id,
        title: p.task.question,
        score: p.grading!.overall.score,
        createdAt: p.createdAt,
      })),
    ...fiches
      .filter(f => f.grading)
      .map(f => ({
        kind: 'fiche' as const,
        id: f.id,
        title: f.task.decision.chamber,
        score: f.grading!.overall.score,
        createdAt: f.createdAt,
      })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)

  const handleResume = () => {
    if (!inProgress) return
    const base = inProgress.kind === 'syllogisme' ? '/legal/syllogisme'
      : inProgress.kind === 'plan' ? '/legal/plan'
      : '/legal/fiche'
    navigate(`${base}?session=${inProgress.id}`)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-fade-in">
      <Helmet>
        <title>Accueil — CRFPA | StudiesKit</title>
      </Helmet>

      {/* Greeting */}
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-heading)]">
          {firstName ? `Bonjour ${firstName}` : 'Bonjour'}
        </h1>
        {showCountdown && (
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Écrit dans <span className="font-semibold text-[var(--text-body)]">{daysUntilExam}</span>{' '}
            {daysUntilExam === 1 ? 'jour' : 'jours'}.
          </p>
        )}
      </div>

      {/* Resume banner — only if in-progress */}
      {inProgress && (
        <button
          onClick={handleResume}
          className="group w-full mb-6 flex items-center gap-4 p-4 rounded-xl border border-[var(--accent-text)]/40 bg-[var(--accent-bg)] hover:bg-[var(--accent-bg)]/80 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-text)]/10 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5 text-[var(--accent-text)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider font-semibold text-[var(--accent-text)]">
              Reprendre ton exercice
            </div>
            <div className="text-sm text-[var(--text-heading)] font-medium truncate">
              {inProgress.kind === 'syllogisme' ? 'Syllogisme'
                : inProgress.kind === 'plan' ? 'Plan détaillé'
                : 'Fiche d\'arrêt'} — {inProgress.title}
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-[var(--accent-text)] group-hover:translate-x-1 transition-transform shrink-0" />
        </button>
      )}

      {/* Action grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <ActionCard
          to="/legal/syllogisme"
          icon={PenSquare}
          title="Syllogisme"
          hint="Majeure, mineure, conclusion — correction méthodologique."
        />
        <ActionCard
          to="/legal/plan"
          icon={ListTree}
          title="Plan détaillé"
          hint="Problématique + I/II structurés, évalués sur 6 axes."
        />
        <ActionCard
          to="/legal/fiche"
          icon={FileText}
          title="Fiche d'arrêt"
          hint="Entraîne-toi sur une décision réelle de la Cour de cassation."
        />
        <ActionCard
          to="/legal"
          icon={Scale}
          title="Oracle"
          hint="Interroge les codes et la jurisprudence française."
        />
        <ActionCard
          to="/sources"
          icon={FolderOpen}
          title="Mes documents"
          hint="Ajoute tes cours, polycopiés, TD."
        />
        <ActionCard
          to="/historique"
          icon={RotateCcw}
          title="Historique"
          hint="Tes entraînements passés et leurs corrections."
        />
      </div>

      {/* Recent strip */}
      {recent.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-3">
            Tes derniers entraînements
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recent.map(r => {
              const base = r.kind === 'syllogisme' ? '/legal/syllogisme'
                : r.kind === 'plan' ? '/legal/plan'
                : '/legal/fiche'
              const href = `${base}?session=${r.id}`
              const kindLabel = r.kind === 'syllogisme' ? 'Syllogisme'
                : r.kind === 'plan' ? 'Plan'
                : 'Fiche d\'arrêt'
              const scoreMax = r.kind === 'fiche' ? 25 : 30
              return (
                <Link
                  key={r.id}
                  to={href}
                  className="glass-card p-3 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
                    {kindLabel}
                  </div>
                  <div className="text-sm font-medium text-[var(--text-heading)] line-clamp-2 leading-snug">
                    {r.title}
                  </div>
                  {r.score !== undefined && (
                    <div className="text-xs text-[var(--text-muted)] mt-2 tabular-nums">
                      {r.score}/{scoreMax}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

interface ActionCardProps {
  to?: string
  icon: typeof PenSquare
  title: string
  hint: string
  disabled?: boolean
}

function ActionCard({ to, icon: Icon, title, hint, disabled }: ActionCardProps) {
  const content = (
    <div className={`group relative h-full p-5 rounded-2xl border transition-all ${
      disabled
        ? 'border-[var(--border-card)] bg-[var(--bg-card)]/50 opacity-50 cursor-not-allowed'
        : 'border-[var(--border-card)] bg-[var(--bg-card)] hover:border-[var(--accent-text)] hover:-translate-y-0.5 hover:shadow-sm cursor-pointer'
    }`}>
      <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[var(--accent-text)]" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-semibold text-[var(--text-heading)]">{title}</div>
        {disabled ? (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">
            Bientôt
          </span>
        ) : (
          <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] group-hover:translate-x-0.5 transition-all shrink-0" />
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">{hint}</p>
    </div>
  )

  if (disabled || !to) return content
  return <Link to={to} className="block">{content}</Link>
}
